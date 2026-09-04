"use client";

import { useEffect, useRef, useState } from "react";
import { Button, IconButton } from "@/components/pouf/Button";
import { Icon } from "@/components/pouf/Icon";
import { MAX_TEXT } from "@/lib/chat-limits";
import type { ChatAction } from "@/lib/chat-events";
import { useChatEvents } from "@/app/_components/chat-live";

// Переписка. Историю рисует сервер, а дальше лента живёт сама: новое приходит по каналу из
// хрома (chat-live), отправленное дописывается ответом на POST. Дедуп по id — своё сообщение
// приходит дважды (ответом и событием), и без него оно двоилось бы на глазах.

export type Line = { id: number; text: string; createdAt: string; mine: boolean; action?: ChatAction | null };

const time = new Intl.DateTimeFormat("ru", { hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long" });

export function Thread({
  conversationId: initialId,
  peerPlayerId,
  peerNickname,
  initial,
  readOnly = false,
}: {
  /** null — разговора ещё не было: беседа заведётся первым же сообщением. */
  conversationId: number | null;
  /** null — собеседник не игрок, а служебный канал лиги: беседа узнаётся только по id. */
  peerPlayerId: number | null;
  peerNickname: string;
  initial: Line[];
  /** Служебный канал: отвечать нельзя, поле ввода не рисуем вовсе. */
  readOnly?: boolean;
}) {
  const [conversationId, setConversationId] = useState(initialId);
  const [lines, setLines] = useState<Line[]>(initial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const append = (line: Line) =>
    setLines((prev) => (prev.some((l) => l.id === line.id) ? prev : [...prev, line]));

  /** Ответ на выбор меняет ровно свою строку: перечитывать всю ленту ради одной кнопки незачем. */
  const replace = (line: Line) => setLines((prev) => prev.map((l) => (l.id === line.id ? line : l)));

  useChatEvents((event) => {
    if (event.type !== "message") return;
    // Пока беседы нет, узнаём свои сообщения по собеседнику: id ещё не известен ни одной стороне.
    const forMe = conversationId
      ? event.conversationId === conversationId
      : peerPlayerId !== null && event.peerPlayerId === peerPlayerId;
    if (!forMe) return;
    setConversationId(event.conversationId);
    append(event.message);
    if (!event.message.mine) void markRead(event.conversationId);
  });

  // Открыл беседу — значит прочитал. Отметка идёт разом при входе, а не по каждому сообщению:
  // человек читает экран целиком.
  useEffect(() => {
    if (conversationId) void markRead(conversationId);
    // Зависимость одна: при смене беседы отметить надо заново.
  }, [conversationId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, playerId: peerPlayerId, text: body }),
      });
      const data = (await res.json()) as { conversationId?: number; message?: Line; error?: string };
      if (!res.ok || !data.message) {
        setError(data.error ?? "Не отправилось");
        return;
      }
      setConversationId(data.conversationId ?? conversationId);
      append(data.message);
      setText("");
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-3">
      <div className="flex min-h-[40vh] flex-1 flex-col justify-end gap-1 overflow-y-auto rounded-control bg-surface p-3 cushion-row">
        {lines.length === 0 ? (
          <p className="m-auto max-w-sm text-center text-sm font-bold text-muted">
            {readOnly
              ? `Здесь пока пусто. ${peerNickname} напишет, когда появится решение по вашей заявке или вас позовут в состав.`
              : `Здесь пока пусто. Напишите ${peerNickname} первым — сообщение придёт ему сразу, а если он не в сети, увидит его при следующем заходе.`}
          </p>
        ) : (
          lines.map((line, i) => (
            <div key={line.id}>
              {/* Разделитель дня: без него вчерашняя переписка сливается с сегодняшней. */}
              {isNewDay(lines[i - 1], line) && (
                <div className="py-2 text-center text-[11px] font-extrabold uppercase tracking-[0.6px] text-ink-subtle">
                  {day.format(new Date(line.createdAt))}
                </div>
              )}
              <div className={`flex ${line.mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[min(560px,80%)] rounded-control px-3 py-2 text-sm font-semibold ${
                    line.mine ? "bg-accent-fill text-[var(--on-accent)]" : "bg-surface-2 text-ink"
                  }`}
                >
                  <span className="whitespace-pre-wrap break-words">{line.text}</span>
                  <span className={`ml-2 align-baseline text-[10px] font-bold ${line.mine ? "opacity-70" : "text-ink-subtle"}`}>
                    {time.format(new Date(line.createdAt))}
                  </span>
                  {line.action && <ActionBlock line={line} onDone={replace} />}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottom} />
      </div>

      {/* Служебный канал: поля ввода нет вовсе. Заблокированное поле обещало бы, что отвечать
          сюда когда-нибудь можно, — а это канал лиги, отвечать в него некому. */}
      {readOnly ? (
        <p className="rounded-control bg-surface-2 px-4 py-3 text-center text-[13px] font-bold text-muted">
          {peerNickname} — служебный канал лиги. Отвечать сюда нельзя: решения и приглашения приходят
          от организаторов, а разговор с людьми — в обычных беседах.
        </p>
      ) : (
      <div className="flex items-end gap-2 rounded-control bg-surface p-2 pl-3.5 cushion-field focus-within:ring-[3px] focus-within:ring-[var(--focus-ring)]">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter отправляет, Shift+Enter переносит строку — как в любом мессенджере.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          maxLength={MAX_TEXT}
          rows={1}
          placeholder={`Сообщение для ${peerNickname}`}
          aria-label="Текст сообщения"
          className="max-h-40 min-h-[40px] flex-1 resize-none border-0 bg-transparent py-2 text-sm font-semibold text-ink outline-none placeholder:text-ink-subtle"
        />
        <IconButton
          label="Отправить"
          icon={<Icon name="send" size="sm" />}
          variant="solid"
          onClick={send}
          disabled={sending || !text.trim()}
        />
      </div>
      )}

      {error && <p className="text-sm font-bold text-[var(--color-err-ink)]">{error}</p>}
    </div>
  );
}

/**
 * Выбор внутри системного сообщения. Кнопки живут в самом пузыре, а не отдельной карточкой под ним:
 * вопрос и ответ на него — один предмет, и разнести их значит заставить искать, к чему относится
 * пара кнопок посреди ленты.
 *
 * После ответа сервер возвращает ту же строку с уже закрытым выбором — её и подставляем на место:
 * так «Вы подтвердили участие» появляется сразу, без перезагрузки, и ровно в том виде, в каком
 * страница нарисует его в следующий раз.
 */
function ActionBlock({ line, onDone }: { line: Line; onDone: (line: Line) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const action = line.action!;

  async function choose(choice: string) {
    setBusy(choice);
    setError(null);
    try {
      const res = await fetch("/api/chat/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: line.id, choice }),
      });
      const data = (await res.json()) as { message?: Line; error?: string };
      if (!res.ok || !data.message) {
        setError(data.error ?? "Не получилось");
        return;
      }
      onDone(data.message);
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setBusy(null);
    }
  }

  if (!action.open) {
    return (
      <p className="mt-2.5 flex items-center gap-1.5 border-t border-hairline pt-2.5 text-[13px] font-bold text-muted">
        <Icon name="ok" size="sm" />
        {action.note}
      </p>
    );
  }

  return (
    <div className="mt-2.5 border-t border-hairline pt-2.5">
      <p className="text-[13px] font-extrabold text-ink">{action.title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {action.options.map((o) => (
          <Button
            key={o.key}
            type="button"
            size="sm"
            variant={o.tone === "accent" ? "solid" : "quiet"}
            loading={busy === o.key}
            disabled={busy !== null}
            onClick={() => choose(o.key)}
          >
            {o.label}
          </Button>
        ))}
      </div>
      {error && <p className="mt-1.5 text-[13px] font-bold text-[var(--color-err-ink)]">{error}</p>}
    </div>
  );
}

function isNewDay(prev: Line | undefined, line: Line): boolean {
  if (!prev) return true;
  return new Date(prev.createdAt).toDateString() !== new Date(line.createdAt).toDateString();
}

/** Отметка прочтения — тихо: не получилось, значит счётчик обновится при следующем заходе. */
function markRead(conversationId: number): Promise<unknown> {
  return fetch("/api/chat/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId }),
  }).catch(() => null);
}
