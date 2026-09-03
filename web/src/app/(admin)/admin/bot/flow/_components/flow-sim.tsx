"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/pouf/Button";
import { FormInput, Label } from "@/components/pouf/Input";
import { Alert } from "@/components/pouf/feedback";
import type { SimState } from "@/lib/bot-flow/simulate";
import type { BotFlowGraph, NodeId } from "@/lib/bot-flow/types";
import { simulateFlow } from "../actions";

/* Симулятор диалога (`BOT-FLOW-PLAN.md`, Э3): тот же интерпретатор, но без телеграма и без записи
 * сессии. Тестов в проекте нет — это и есть способ проверить граф до живого чата.
 *
 * Состояние разговора (нода и переменные) живёт ЗДЕСЬ и уезжает на сервер каждым ходом. Так на
 * сервере от прогона не остаётся ничего: строку в `BotSession` симулятор не трогает, и запустить
 * его можно хоть на работающем боте — человека посреди анкеты он не собьёт.
 *
 * Граф берётся из состояния редактора, а не из базы: проверять нужно то, что нарисовано сейчас,
 * включая несохранённый черновик.
 */

/** Строка разговора. `keyboard` — клавиатура, которую бот показал этой репликой. */
type Line = { who: "бот" | "человек"; text: string; keyboard?: string[][] | null };

const EMPTY: SimState = { node: null, vars: {} };

/** Куда ушёл прогон, если это уже не правимый граф (Э7): «в меню» уводит в главный флоу. */
const away = (flow: string, edited: string, title?: string) =>
  flow === edited ? null : `Разговор ушёл во флоу «${title || flow}» — дальше отвечает он, а не этот граф.`;

export function FlowSim({
  graph,
  flows,
  onTrace,
}: {
  graph: BotFlowGraph;
  /** Соседние флоу: по ним прогон объясняет, куда ушёл разговор, словами, а не ключом (Э7). */
  flows: { key: string; title?: string }[];
  /** Куда пришёл симулятор и через что прошёл — канвас подсвечивает это на карточках. */
  onTrace: (active: NodeId | null, trail: NodeId[]) => void;
}) {
  const [log, setLog] = useState<Line[]>([]);
  const [state, setState] = useState<SimState>(EMPTY);
  const [text, setText] = useState("");
  const [who, setWho] = useState({ chatId: "", username: "" });
  const [note, setNote] = useState<{ tone: "warn" | "err" | "info"; text: string } | null>(null);
  const [started, setStarted] = useState(false);
  const [busy, startTransition] = useTransition();
  const tail = useRef<HTMLDivElement>(null);

  // Лента прокручивается к последней реплике сама: иначе ответ бота уезжает под нижний край.
  useEffect(() => {
    tail.current?.scrollTo({ top: tail.current.scrollHeight });
  }, [log]);

  const step = (message: string, from: SimState, human: boolean) =>
    startTransition(async () => {
      if (human) setLog((l) => [...l, { who: "человек", text: message }]);
      const res = await simulateFlow(JSON.stringify(graph), from, message, who);
      if ("error" in res) {
        setNote({ tone: "err", text: res.error });
        return;
      }
      const { step: done } = res;
      setLog((l) => [...l, ...done.replies.map((r) => ({ who: "бот" as const, text: r.text, keyboard: r.keyboard }))]);
      setState({ flow: done.flow, node: done.node, vars: done.vars });
      // След подсвечиваем, только пока разговор в правимом графе: у чужих нод бывают те же имена,
      // и подсветка «по совпадению» врала бы про пройденный путь.
      onTrace(done.flow === graph.key ? done.node : null, done.flow === graph.key ? done.trail : []);
      setStarted(true);
      const gone = away(done.flow, graph.key, flows.find((f) => f.key === done.flow)?.title);
      if (done.error) setNote({ tone: "err", text: `Нода упала: ${done.error}. В живом боте здесь была бы фраза «что-то пошло не так» и возврат в меню.` });
      else if (done.lost) setNote({ tone: "warn", text: "Ноды, на которой стоял разговор, в графе больше нет — сессия снята." });
      else if (done.outside) setNote({ tone: "warn", text: "Нода за ответ не взялась: у кнопки нет перехода либо у меню пусто «непонятое». В живом боте человек оказался бы в начале разговора." });
      else if (!done.node) setNote({ tone: "info", text: "Диалог окончен: следующее сообщение начнёт его заново." });
      else if (gone) setNote({ tone: "info", text: gone });
      else setNote(null);
    });

  // Чем прогон начинается: тем же сообщением, которым в этот граф входит живой человек (Э7). У
  // онбординга это `/start invite`, у сценария из уведомления — его кнопка. Слать всем «/start»
  // значило бы каждый раз проверять главное меню вместо графа, открытого на экране.
  const opening = (() => {
    const payload = graph.entry?.payloads?.find((p) => p.trim())?.trim();
    if (payload) return `/start ${payload}`;
    return graph.entry?.buttons?.find((b) => b.trim())?.trim() || "/start";
  })();

  const restart = () => {
    setLog([{ who: "человек", text: opening }]);
    setNote(null);
    step(opening, { ...EMPTY, flow: graph.key }, false);
  };

  const send = (message: string) => {
    const value = message.trim();
    if (!value) return;
    setText("");
    step(value, state, true);
  };

  const keyboard = [...log].reverse().find((l) => l.who === "бот")?.keyboard ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <Label htmlFor="sim-chat">Чат</Label>
          <FormInput
            id="sim-chat"
            size="sm"
            className="mt-1 w-full"
            value={who.chatId}
            placeholder="chatId — пусто значит незнакомец"
            onChange={(e) => setWho({ ...who, chatId: e.target.value })}
          />
        </div>
        <div className="min-w-0 flex-1">
          <Label htmlFor="sim-user">Хендл</Label>
          <FormInput
            id="sim-user"
            size="sm"
            className="mt-1 w-full"
            value={who.username}
            placeholder="username без @"
            onChange={(e) => setWho({ ...who, username: e.target.value })}
          />
        </div>
        <Button size="sm" variant="quiet" disabled={busy} onClick={restart} title={`Начать с «${opening}»`}>
          {started ? "Заново" : opening}
        </Button>
      </div>
      <p className="text-xs font-bold leading-[1.5] text-muted">
        По чату и хендлу считается <code>ctx.*</code> — узнает ли лига этого человека. Оставьте пустыми, чтобы
        посмотреть глазами незнакомца. Переписка никуда не сохраняется, боту ничего не уходит.
      </p>

      <div ref={tail} className="max-h-64 space-y-1.5 overflow-y-auto rounded-card bg-surface-2 p-2 cushion-field">
        {!log.length && <p className="p-2 text-xs font-bold text-muted">Нажмите «{opening}» — тем же сообщением в этот граф попадает живой человек.</p>}
        {log.map((line, i) => (
          <div
            key={i}
            // Реплики различаются стороной и рельефом: бот приподнят подушкой, человек вдавлен —
            // как поле ввода, из которого он это написал.
            className={`max-w-[85%] rounded-control p-2 text-xs font-bold leading-[1.5] text-ink ${
              line.who === "бот" ? "bg-surface cushion-row" : "ml-auto bg-surface-3 cushion-field"
            }`}
          >
            <span className="whitespace-pre-wrap">{line.text}</span>
          </div>
        ))}
      </div>

      {keyboard && !!keyboard.length && (
        <div className="space-y-1">
          {keyboard.map((row, i) => (
            <div key={i} className="flex flex-wrap gap-1.5">
              {row.map((label) => (
                <Button key={label} size="xs" variant="quiet" disabled={busy} onClick={() => send(label)}>
                  {label}
                </Button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <FormInput
          size="sm"
          className="min-w-0 flex-1"
          value={text}
          placeholder="Ответить текстом"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              send(text);
            }
          }}
        />
        <Button size="sm" disabled={busy || !text.trim()} onClick={() => send(text)}>
          Отправить
        </Button>
      </div>

      {note && (
        <Alert tone={note.tone} block>
          {note.text}
        </Alert>
      )}

      <div>
        <Label>Переменные</Label>
        {Object.keys(state.vars).length ? (
          <ul className="mt-1 space-y-1">
            {Object.entries(state.vars).map(([name, value]) => (
              <li key={name} className="flex items-baseline gap-2 text-xs font-bold">
                <code className="shrink-0 text-muted">vars.{name}</code>
                <span className="min-w-0 break-words text-ink">{value || "— пусто —"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs font-bold text-muted">Пока ничего не собрано.</p>
        )}
      </div>
    </div>
  );
}
