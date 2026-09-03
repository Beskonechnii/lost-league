"use client";

import { Button } from "@/components/pouf/Button";
import { FormInput, FormSelect, FormTextarea, Label } from "@/components/pouf/Input";
import { Checkbox } from "@/components/pouf/checkbox";
import { Alert } from "@/components/pouf/feedback";
import { portsOf, setPort } from "@/lib/bot-flow/editor";
import type { FlowActionInfo } from "@/lib/bot-flow/registries";
import {
  isWaiting,
  servicePolicyOf,
  type BotFlowGraph,
  type FlowButton,
  type FlowCondition,
  type FlowNode,
  type FlowOp,
  type NodeId,
  type ServicePolicy,
} from "@/lib/bot-flow/types";

/* Инспектор выбранной ноды: всё, чего не видно на карточке канваса.
 *
 * Правка идёт «нода целиком»: обработчик получает НОВУЮ ноду и кладёт её в граф. Точечных
 * `onChangeText`/`onChangeVar` тут нет намеренно — типов нод девять, и на каждый пришлось бы
 * заводить свой набор колбэков.
 *
 * Цель выхода правится в двух местах: мышью на канвасе (быстро) и списком здесь (надёжно, и это
 * единственный способ связь СНЯТЬ — промах мимо ноды на канвасе ничего не меняет специально).
 */

const OPS: FlowOp[] = ["=", "≠", ">", "<", "есть", "нет"];
const REF_LIST = "bot-flow-refs";

export function FlowInspector({
  node,
  graph,
  onChange,
  onDelete,
  onMakeStart,
  ctxKeys,
  settingKeys,
  actions,
  subflows,
}: {
  node: FlowNode | null;
  graph: BotFlowGraph;
  onChange: (next: FlowNode) => void;
  onDelete: () => void;
  onMakeStart: () => void;
  /** Что можно написать после `ctx.` — приходит с сервера (`bot-flow/context.ts`). */
  ctxKeys: string[];
  /** Что можно написать после `settings.` — реестры текстов и таймингов бота. */
  settingKeys: string[];
  /** Зарегистрированные действия: подпись, пояснение, обязательные параметры (`bot-flow/actions.ts`). */
  actions: FlowActionInfo[];
  /** Зарегистрированные модули для ноды «модуль» (`bot-flow/subflows.ts`). Формат тот же. */
  subflows: FlowActionInfo[];
}) {
  if (!node) {
    return (
      <p className="text-sm font-bold text-muted">
        Ноду не выбрали. Нажмите на карточку на канвасе — здесь появятся её текст, переменные и выходы.
      </p>
    );
  }

  const isStart = graph.start === node.id;
  // Переменные, которые собирает граф: имена вопросов. Подсказка, а не проверка — валидатор на Э3.
  const varRefs = graph.nodes.filter((n) => n.type === "ask").map((n) => `vars.${n.var}`);
  const refs = [...new Set([...varRefs, ...ctxKeys.map((k) => `ctx.${k}`), ...settingKeys.map((k) => `settings.${k}`)])];

  const patch = (fields: Partial<FlowNode>) => onChange({ ...node, ...fields } as FlowNode);

  return (
    <div className="space-y-4 font-pouf">
      {/* Один datalist на весь инспектор: подсказка ссылок нужна и условиям, и текстам. */}
      <datalist id={REF_LIST}>
        {refs.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-pill bg-surface-2 px-2 py-1 text-[11px] font-black uppercase tracking-[0.4px] text-muted">
          {node.type}
        </span>
        <code className="text-[11px] font-bold text-muted">{node.id}</code>
        {isStart && <span className="text-[11px] font-black uppercase text-accent-bright">старт</span>}
      </div>

      <div>
        <Label htmlFor="flow-title">Заголовок ноды</Label>
        <FormInput
          id="flow-title"
          size="sm"
          className="mt-1 w-full"
          value={node.title ?? ""}
          placeholder="виден только здесь и на канвасе"
          onChange={(e) => patch({ title: e.target.value })}
        />
      </div>

      <Body node={node} onChange={onChange} refs={REF_LIST} actions={actions} subflows={subflows} />

      {isWaiting(node) && <Service node={node} onChange={onChange} />}

      <Ports node={node} graph={graph} onChange={onChange} />

      <div className="flex flex-wrap gap-2 pt-1">
        {!isStart && (
          <Button size="xs" variant="quiet" onClick={onMakeStart}>
            Сделать стартовой
          </Button>
        )}
        <Button size="xs" variant="quiet" tone="down" onClick={onDelete} disabled={isStart}>
          Удалить ноду
        </Button>
      </div>
      {isStart && (
        <p className="text-xs font-bold text-muted">
          Стартовую ноду не удалить: без неё диалогу неоткуда начаться. Назначьте стартовой другую — и эта освободится.
        </p>
      )}
    </div>
  );
}

/**
 * Что нода делает со служебной кнопкой — подписью перехвата флоу, нажатой посреди разговора.
 * Спрашиваем только у ждущих нод: на проходной ноде разговор не стоит, и перехватывать там нечего.
 */
function Service({ node, onChange }: { node: FlowNode; onChange: (n: FlowNode) => void }) {
  const value = servicePolicyOf(node);
  return (
    <div>
      <Label htmlFor="flow-service">Служебная кнопка</Label>
      <FormSelect
        id="flow-service"
        size="sm"
        className="mt-1 w-full"
        value={value}
        onChange={(e) => onChange({ ...node, service: e.target.value as ServicePolicy } as FlowNode)}
      >
        <option value="перехват">срабатывает перехват — уйти туда, куда он ведёт</option>
        <option value="повторить">не бросать начатое — повторить вопрос этой ноды</option>
      </FormSelect>
      <Hint>
        {value === "повторить"
          ? "Кнопка меню, нажатая здесь, не оборвёт разговор: бот попросит закончить начатое и повторит вопрос. Выйти можно /cancel."
          : "Кнопка меню, нажатая здесь, уводит по перехвату: терять на этой ноде нечего."}
      </Hint>
    </div>
  );
}

/* ── Поля, свои у каждого типа ──────────────────────────────────────────────────────────────── */

function Body({
  node,
  onChange,
  refs,
  actions,
  subflows,
}: {
  node: FlowNode;
  onChange: (n: FlowNode) => void;
  refs: string;
  actions: FlowActionInfo[];
  subflows: FlowActionInfo[];
}) {
  switch (node.type) {
    case "start":
      return (
        <div>
          <Label htmlFor="flow-payload">Deeplink-payload</Label>
          <FormInput
            id="flow-payload"
            size="sm"
            className="mt-1 w-full"
            value={node.payload ?? ""}
            placeholder="пусто — обычный /start"
            onChange={(e) => onChange({ ...node, payload: e.target.value || null })}
          />
          <Hint>Значение из ссылки вида t.me/бот?start=invite. Пусто — вход для всех остальных.</Hint>
        </div>
      );

    case "message":
    case "menu":
      return (
        <>
          <TextField value={node.text} set={(text) => onChange({ ...node, text })} />
          <Buttons node={node} onChange={onChange} refs={refs} />
        </>
      );

    case "ask":
      return (
        <>
          <TextField value={node.text} set={(text) => onChange({ ...node, text })} />
          <div>
            <Label htmlFor="flow-var">Переменная</Label>
            <FormInput
              id="flow-var"
              size="sm"
              mono
              className="mt-1 w-full"
              value={node.var}
              onChange={(e) => onChange({ ...node, var: e.target.value })}
            />
            <Hint>Ответ ляжет в vars.{node.var || "…"} — под этим именем его подставляют дальше по графу.</Hint>
          </div>
          <div>
            <Label htmlFor="flow-check">Проверка ответа</Label>
            <FormSelect
              id="flow-check"
              size="sm"
              className="mt-1 w-full"
              value={node.check?.kind ?? "любой"}
              onChange={(e) => {
                const kind = e.target.value as NonNullable<typeof node.check>["kind"];
                onChange({ ...node, check: kind === "любой" ? null : { ...(node.check ?? {}), kind } });
              }}
            >
              {["любой", "число", "ссылка", "телеграм", "regex"].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </FormSelect>
            {node.check?.kind === "regex" && (
              <FormInput
                size="sm"
                mono
                className="mt-2 w-full"
                value={node.check.pattern ?? ""}
                placeholder="^[0-9]{4}$"
                onChange={(e) => onChange({ ...node, check: { ...node.check!, pattern: e.target.value } })}
              />
            )}
            {node.check && (
              <FormInput
                size="sm"
                className="mt-2 w-full"
                value={node.check.message ?? ""}
                placeholder="что сказать, когда ответ не прошёл"
                onChange={(e) => onChange({ ...node, check: { ...node.check!, message: e.target.value } })}
              />
            )}
          </div>
          <Buttons node={node} onChange={onChange} refs={refs} />
        </>
      );

    case "if":
      return (
        <div>
          <Label>Условие</Label>
          <Condition
            cond={node.cond}
            refs={refs}
            required
            onChange={(cond) => onChange({ ...node, cond: cond ?? { left: "", op: "есть" } })}
          />
        </div>
      );

    case "action": {
      const chosen = actions.find((a) => a.name === node.action.trim()) ?? null;
      return (
        <>
          <div>
            <Label htmlFor="flow-action">Действие</Label>
            {/* Список, а не свободный ввод: имя действия сверяется с реестром, и опечатка — это
                ошибка валидатора, на которой интерпретатор упал бы посреди разговора. Ноду со
                снятым реестром (действие переименовали) показываем отдельной строкой, чтобы её
                было видно, а не молча подменяли первой из списка. */}
            <FormSelect
              id="flow-action"
              size="sm"
              className="mt-1 w-full"
              value={node.action}
              onChange={(e) => {
                const next = actions.find((a) => a.name === e.target.value);
                // Обязательные параметры заводим пустыми: так видно, что их надо заполнить, а
                // уже написанные значения не теряются при смене действия.
                const params = { ...(node.params ?? {}) };
                for (const key of next?.params ?? []) params[key] ??= "";
                onChange({ ...node, action: e.target.value, params });
              }}
            >
              <option value="">— выберите действие —</option>
              {actions.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.label} ({a.name})
                </option>
              ))}
              {node.action.trim() && !chosen && <option value={node.action}>{node.action} — нет в реестре</option>}
            </FormSelect>
            {chosen?.hint && <Hint>{chosen.hint}</Hint>}
          </div>
          <div>
            <Label htmlFor="flow-params">Параметры</Label>
            <FormTextarea
              id="flow-params"
              mono
              rows={3}
              className="mt-1 w-full"
              value={Object.entries(node.params ?? {})
                .map(([k, v]) => `${k}=${v}`)
                .join("\n")}
              placeholder={"имя=значение\nодна пара в строке"}
              onChange={(e) => onChange({ ...node, params: parseParams(e.target.value) })}
            />
            <Hint>
              {chosen?.params?.length
                ? `Действие ждёт: ${chosen.params.join(", ")}. В значении работают подстановки — {vars.турнир_id}.`
                : "В значении работают подстановки — {vars.турнир_id}: их посчитают перед вызовом."}
            </Hint>
          </div>
        </>
      );
    }

    case "subflow": {
      const chosenModule = subflows.find((s) => s.name === node.flow.trim()) ?? null;
      return (
        <>
          <div>
            <Label htmlFor="flow-module">Модуль</Label>
            {/* Список, а не свободный ввод — по той же причине, что у действия: имя сверяется с
                реестром, и опечатка уронила бы интерпретатор посреди разговора. */}
            <FormSelect
              id="flow-module"
              size="sm"
              className="mt-1 w-full"
              value={node.flow}
              onChange={(e) => {
                const next = subflows.find((s) => s.name === e.target.value);
                const params = { ...(node.params ?? {}) };
                for (const key of next?.params ?? []) params[key] ??= "";
                onChange({ ...node, flow: e.target.value, params });
              }}
            >
              <option value="">— выберите модуль —</option>
              {subflows.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.label} ({s.name})
                </option>
              ))}
              {node.flow.trim() && !chosenModule && <option value={node.flow}>{node.flow} — нет в реестре</option>}
            </FormSelect>
            {chosenModule?.hint && <Hint>{chosenModule.hint}</Hint>}
          </div>
          <div>
            <Label htmlFor="flow-module-params">Параметры</Label>
            <FormTextarea
              id="flow-module-params"
              mono
              rows={2}
              className="mt-1 w-full"
              value={Object.entries(node.params ?? {})
                .map(([k, v]) => `${k}=${v}`)
                .join("\n")}
              placeholder={"имя=значение\nодна пара в строке"}
              onChange={(e) => onChange({ ...node, params: parseParams(e.target.value) })}
            />
            <Hint>
              {chosenModule?.params?.length
                ? `Модуль принимает: ${chosenModule.params.join(", ")}. В значении работают подстановки — {vars.турнир_id}.`
                : "Этот модуль параметров не принимает."}
            </Hint>
          </div>
          <Alert tone="info" block>
            Модуль забирает разговор себе на несколько ходов и говорит своими кнопками. Выход «отменено» —
            модуль не взялся за работу (нечего заполнять, нет прав); брошенный на середине диалог модули
            от нормального конца не отличают и оба отдают в «готово».
          </Alert>
        </>
      );
    }

    case "goto":
      return <Hint>Куда ведёт переход — в списке выходов ниже.</Hint>;

    case "end":
      return (
        <>
          <div>
            <Label htmlFor="flow-bye">Прощание</Label>
            <FormTextarea
              id="flow-bye"
              rows={2}
              className="mt-1 w-full"
              value={node.text ?? ""}
              placeholder="пусто — бот попрощается молча"
              onChange={(e) => onChange({ ...node, text: e.target.value || null })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-bold text-ink">
            <Checkbox
              checked={node.toMenu !== false}
              onCheckedChange={(v) => onChange({ ...node, toMenu: v === true })}
            />
            Вернуть в главное меню
          </label>
        </>
      );
  }
}

/* ── Общие кусочки ──────────────────────────────────────────────────────────────────────────── */

const Hint = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-1 text-xs font-bold leading-[1.5] text-muted">{children}</p>
);

function TextField({ value, set }: { value: string; set: (text: string) => void }) {
  return (
    <div>
      <Label htmlFor="flow-text">Что говорит бот</Label>
      <FormTextarea id="flow-text" rows={4} className="mt-1 w-full" value={value} onChange={(e) => set(e.target.value)} />
      <Hint>
        Разметка как в остальных сообщениях бота: &lt;b&gt;жирный&lt;/b&gt;. Подстановка в фигурных скобках —
        {" {vars.ник}"}, {"{ctx.игрок}"}, {"{settings.menu}"}; незнакомая скобка останется текстом.
      </Hint>
    </div>
  );
}

function Condition({
  cond,
  refs,
  required = false,
  onChange,
}: {
  cond: FlowCondition | null | undefined;
  refs: string;
  /** У ноды «развилка» условие — сама суть ноды, снимать его нечем. */
  required?: boolean;
  onChange: (cond: FlowCondition | null) => void;
}) {
  if (!cond) {
    return (
      <Button size="xs" variant="quiet" className="mt-1" onClick={() => onChange({ left: "ctx.известен", op: "=", right: "да" })}>
        Добавить условие
      </Button>
    );
  }
  const needsRight = cond.op !== "есть" && cond.op !== "нет";
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <FormInput
        size="sm"
        mono
        list={refs}
        className="min-w-0 flex-1"
        value={cond.left}
        placeholder="ctx.известен"
        onChange={(e) => onChange({ ...cond, left: e.target.value })}
      />
      <FormSelect size="sm" className="w-[5.5rem]" value={cond.op} onChange={(e) => onChange({ ...cond, op: e.target.value as FlowOp })}>
        {OPS.map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </FormSelect>
      {needsRight && (
        <FormInput
          size="sm"
          className="min-w-0 flex-1"
          value={cond.right ?? ""}
          placeholder="да"
          onChange={(e) => onChange({ ...cond, right: e.target.value })}
        />
      )}
      {!required && (
        <Button size="xs" variant="quiet" onClick={() => onChange(null)}>
          убрать
        </Button>
      )}
    </div>
  );
}

/** Кнопки ноды. Подпись кнопки — она же ключ перехода: именно её человек пришлёт обычным сообщением. */
function Buttons({
  node,
  onChange,
  refs,
}: {
  node: Extract<FlowNode, { type: "message" | "ask" | "menu" }>;
  onChange: (n: FlowNode) => void;
  refs: string;
}) {
  const buttons: FlowButton[] = node.buttons ?? [];
  const set = (next: FlowButton[]) => onChange({ ...node, buttons: next } as FlowNode);
  const patch = (i: number, fields: Partial<FlowButton>) => set(buttons.map((b, j) => (j === i ? { ...b, ...fields } : b)));

  return (
    <div>
      <Label>Кнопки</Label>
      <Hint>
        Подпись кнопки — ключ перехода: клавиатура у бота обычная, и ответ приезжает текстом. Две одинаковые
        подписи в одной ноде — ошибка; куда ведёт кнопка, задаётся в выходах ниже или связью на канвасе.
      </Hint>
      <ul className="mt-2 space-y-2">
        {buttons.map((b, i) => (
          <li key={i} className="rounded-control bg-surface-2 p-2 cushion-field">
            <div className="flex items-center gap-1.5">
              <FormInput
                size="sm"
                className="min-w-0 flex-1"
                value={b.label}
                placeholder="Текст на кнопке"
                onChange={(e) => patch(i, { label: e.target.value })}
              />
              {/* Ширину держит обёртка, а не сам инпут: поле Кита носит `w-full` в базовых классах,
                  и `w-16` на нём проигрывает — рядом стоящая подпись схлопывалась в точку. */}
              <div className="w-16 shrink-0">
                <FormInput
                  size="sm"
                  type="number"
                  value={b.row ?? ""}
                  placeholder="ряд"
                  title="Номер ряда: кнопки с одним номером встают в строку"
                  onChange={(e) => patch(i, { row: e.target.value === "" ? undefined : Number(e.target.value) })}
                />
              </div>
              <Button size="xs" variant="quiet" onClick={() => set(buttons.filter((_, j) => j !== i))}>
                ×
              </Button>
            </div>
            <Condition cond={b.when} refs={refs} onChange={(when) => patch(i, { when })} />
          </li>
        ))}
      </ul>
      <Button
        size="xs"
        variant="quiet"
        className="mt-2"
        onClick={() => set([...buttons, { label: "", next: null }])}
      >
        Добавить кнопку
      </Button>
    </div>
  );
}

/** Выходы ноды списком: единственное место, где связь можно снять. */
function Ports({ node, graph, onChange }: { node: FlowNode; graph: BotFlowGraph; onChange: (n: FlowNode) => void }) {
  const ports = portsOf(node);
  if (!ports.length) return null;
  return (
    <div>
      <Label>Выходы</Label>
      <ul className="mt-1 space-y-1.5">
        {ports.map((p) => (
          <li key={p.key} className="flex items-center gap-2">
            <span className="w-[8rem] shrink-0 truncate text-xs font-extrabold text-muted" title={p.label}>
              {p.kind === "button" ? `«${p.label}»` : p.label}
            </span>
            <FormSelect
              size="sm"
              className="min-w-0 flex-1"
              value={p.target ?? ""}
              onChange={(e) => onChange(setPort(node, p.key, (e.target.value || null) as NodeId | null))}
            >
              <option value="">— наружу, старому обработчику —</option>
              {/* Своя нода в списке есть: переход на себя это не описка, а рабочий приём — так меню
                  отвечает на непонятый текст собой же (дефолтный граф). Без неё такой выход
                  показывался бы как «наружу» и стирался первой же правкой соседнего. */}
              {graph.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.id === node.id ? `эта же нода (${n.id})` : n.title ? `${n.title} (${n.id})` : n.id}
                </option>
              ))}
            </FormSelect>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** `имя=значение` построчно → объект параметров действия. */
function parseParams(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const at = line.indexOf("=");
    if (at < 1) continue;
    out[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return out;
}
