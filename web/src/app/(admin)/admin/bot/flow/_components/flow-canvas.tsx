"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DragBoard, DragCard } from "@/components/pouf/board";
import { Button } from "@/components/pouf/Button";
import { portsOf, type FlowPort } from "@/lib/bot-flow/editor";
import type { FlowIssueLevel } from "@/lib/bot-flow/validate";
import type { BotFlowGraph, FlowNode, NodeId } from "@/lib/bot-flow/types";

/* Канвас графа диалога: ноды карточками, связи линиями, перетаскивание и протяжка связи мышью.
 *
 * Геометрия ноды ЖЁСТКАЯ (`NODE_W`, `HEAD_H`, `BODY_H`, `PORT_H`) — и это не лень, а условие
 * задачи: линию связи надо начать ровно в точке выхода, а точка выхода живёт в SVG-слое, который
 * ничего не знает о вёрстке карточки. Мерить DOM пришлось бы после каждого рендера, каждой правки
 * инспектора и каждой прокрутки; фиксированные размеры дают ту же точку арифметикой. Поэтому
 * карточка не растёт от содержимого: длинный текст обрезается, а не переносится.
 *
 * Перетаскивание — атом Кита (`pouf/board.tsx`) в режиме `follow`: за курсором едет сама нода, а
 * не её копия, и по броску экран получает смещение. Связи — свои pointer-события, а не второй
 * dnd-контекст: у dnd-kit цель это droppable, а тут целью может быть любая нода, включая ту, что
 * сейчас под курсором случайно.
 *
 * Масштаб и панорама (правка после Э7): поле рисуется в СВОИХ координатах и целиком
 * масштабируется одним `scale` — так карточки, связи и сетка не разъезжаются между собой, а
 * арифметика точек выхода остаётся прежней. Всё, что приходит от мыши (смещение броска, курсор
 * протяжки, место новой ноды), делится на масштаб на границе: внутри канваса координаты всегда
 * «полевые», снаружи — экранные.
 */

export const NODE_W = 232;
const HEAD_H = 30;
const BODY_H = 34;
const PORT_H = 24;
const PAD = 10;
/** Запас поля вокруг самой дальней ноды — чтобы всегда было куда двигать и что класть. */
const MARGIN = 480;

/** Пределы и шаг масштаба. Ниже 30% карточка нечитаема, выше 160% смотреть уже не на что. */
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 1.6;
const ZOOM_STEP = 0.1;
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));

export const nodeHeight = (node: FlowNode): number => HEAD_H + BODY_H + portsOf(node).length * PORT_H + PAD;

/** Точка, из которой выходит связь: правый край карточки на уровне своей строки-выхода. */
const outPoint = (node: FlowNode, i: number) => ({
  x: (node.x ?? 0) + NODE_W,
  y: (node.y ?? 0) + HEAD_H + BODY_H + i * PORT_H + PORT_H / 2,
});

/** Точка, в которую связь приходит: левый край чужой карточки на уровне её шапки. */
const inPoint = (node: FlowNode) => ({ x: node.x ?? 0, y: (node.y ?? 0) + HEAD_H / 2 });

/**
 * Кривая связи. Два случая, и второй — не украшательство:
 *
 * · вперёд (цель правее выхода) — обычная s-кривая, вынос управляющих точек растёт с расстоянием:
 *   у соседних нод линия почти прямая, у далёких — плавная дуга, а не «пружина»;
 * · назад (цель левее или вплотную) — а это половина живого графа: любой возврат в меню идёт
 *   справа налево. Прямая кривая тут ложится поверх обеих карточек и читается как линия «в
 *   никуда». Поэтому связь выходит вправо, уходит в свободную полосу выше или ниже ряда и
 *   заходит в цель слева — тем же жестом, каким это рисуют от руки.
 */
const wirePath = (a: { x: number; y: number }, b: { x: number; y: number }): string => {
  const dx = b.x - a.x;
  if (dx > 40) {
    const k = Math.min(Math.max(dx * 0.5, 40), 180);
    return `M ${a.x} ${a.y} C ${a.x + k} ${a.y}, ${b.x - k} ${b.y}, ${b.x} ${b.y}`;
  }
  const out = a.x + 46;
  const into = b.x - 46;
  // Полоса объезда: между рядами, а при почти одинаковой высоте — ниже обеих нод, иначе линия
  // пройдёт ровно по их шапкам.
  const lane = Math.abs(b.y - a.y) < 56 ? Math.max(a.y, b.y) + 78 : (a.y + b.y) / 2;
  const mid = (out + into) / 2;
  return [
    `M ${a.x} ${a.y}`,
    `C ${out + 34} ${a.y}, ${out + 34} ${lane}, ${mid} ${lane}`,
    `C ${into - 34} ${lane}, ${into - 34} ${b.y}, ${b.x} ${b.y}`,
  ].join(" ");
};

/** Тип ноды словом — на карточке он важнее заголовка: по нему читается, что нода делает. */
const TYPE_LABEL: Record<FlowNode["type"], string> = {
  start: "вход",
  message: "реплика",
  ask: "вопрос",
  menu: "меню",
  if: "развилка",
  action: "действие",
  subflow: "модуль",
  goto: "переход",
  end: "конец",
};

/** Одна строка о содержимом ноды — то, ради чего на неё смотрят, не открывая инспектор. */
function preview(node: FlowNode): string {
  switch (node.type) {
    case "start":
      return node.payload ? `deeplink: ${node.payload}` : "/start и первое сообщение";
    case "message":
    case "menu":
      return node.text || "текст не задан";
    case "ask":
      return `${node.text || "текст не задан"} → vars.${node.var}`;
    case "if":
      return `${node.cond.left} ${node.cond.op} ${node.cond.right ?? ""}`.trim();
    case "action":
      return node.action || "действие не выбрано";
    case "subflow":
      return node.flow || "модуль не выбран";
    case "goto":
      return node.target ? `→ ${node.target}` : "цель не задана";
    case "end":
      return node.toMenu ? "вернуть в меню" : "закрыть диалог";
  }
}

/**
 * Цвет типа ноды: заливка значка, полоска у левого края карточки и основа для цвета связей.
 *
 * Цвет тут работает как подпись, которую видно с высоты «вписать»: на общем плане текст уже не
 * читается, а «откуда пришла эта линия» и «сколько тут развилок» видно по цвету. Поэтому цвет
 * связи берётся у НОДЫ-ИСТОЧНИКА, а не у ноды-цели: в густом месте взгляд идёт по линии назад, к
 * тому, кто её послал.
 *
 * Тон задан парой «оттенок — насыщенность», а не тремя готовыми hex: из них же считаются оттенки
 * отдельных выходов (`portColor`), а перебирать руками по девять цветов на каждый тип — это тот
 * самый второй источник правды.
 */
const NODE_HUE: Record<FlowNode["type"], { h: number; s: number }> = {
  start: { h: 152, s: 40 },
  message: { h: 205, s: 55 },
  ask: { h: 42, s: 68 },
  menu: { h: 258, s: 45 },
  if: { h: 0, s: 52 },
  action: { h: 176, s: 42 },
  subflow: { h: 26, s: 72 },
  goto: { h: 218, s: 22 },
  end: { h: 40, s: 8 },
};

/** Тон типа тремя ролями: плашка, текст на ней, линия на бумаге. */
export const NODE_TONE = Object.fromEntries(
  Object.entries(NODE_HUE).map(([type, { h, s }]) => [
    type,
    {
      fill: `hsl(${h} ${s}% 72%)`,
      ink: `hsl(${h} ${Math.min(s + 12, 80)}% 26%)`,
      line: `hsl(${h} ${Math.min(s + 8, 80)}% 45%)`,
    },
  ]),
) as Record<FlowNode["type"], { fill: string; ink: string; line: string }>;

/**
 * Цвет ОДНОГО выхода ноды: свой у каждого, но в пределах тона своего типа.
 *
 * Ради этого всё и затевалось: у меню шесть кнопок, и шесть линий одного цвета из одной карточки
 * различаются только точкой, из которой вышли, — на общем плане это неразличимо. Оттенок
 * расходится веером вокруг тона типа, светлота чередуется, так что соседние строки не сливаются
 * даже при близких оттенках. Считается арифметикой от номера выхода: порядок выходов — свойство
 * ноды, значит цвет строки не «уедет» при следующем открытии редактора.
 */
export const portColor = (type: FlowNode["type"], i: number, count: number): string => {
  const { h, s } = NODE_HUE[type];
  const spread = count > 1 ? (i - (count - 1) / 2) * Math.min(84 / count, 16) : 0;
  const light = 45 + (i % 2) * 9;
  return `hsl(${(h + spread + 360) % 360} ${Math.min(s + 8, 80)}% ${light}%)`;
};

/** Цвет симуляторного следа — он про «здесь только что прошли», а не про тип ноды. */
const TRAIL_LINE = "var(--color-ok-ink)";

type Wire = { from: NodeId; port: string; x: number; y: number };
/** Связь, готовая к отрисовке: путь, цвет своей ноды и то, чем она сейчас выделена. */
type Edge = { key: string; d: string; color: string; width: number; opacity: number; lift: boolean };

/** Идентификатор наконечника под цвет: маркер не наследует обводку линии, а цветов теперь много. */
const markerId = (color: string) => `wire-${color.replace(/[^a-z0-9]/gi, "")}`;

export function FlowCanvas({
  graph,
  scrollRef,
  selected,
  marks,
  active,
  trail,
  onSelect,
  onMove,
  onConnect,
  onZoom,
}: {
  graph: BotFlowGraph;
  /** Прокрутка канваса наружу: по ней редактор кладёт новую ноду туда, что сейчас видно. */
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  selected: NodeId | null;
  /** Претензии валидатора по нодам: карточка носит значок, чтобы список не приходилось читать целиком. */
  marks?: Map<NodeId, FlowIssueLevel>;
  /** Нода, на которой стоит симулятор. */
  active?: NodeId | null;
  /** Ноды, через которые симулятор прошёл последним ходом. */
  trail?: Set<NodeId>;
  onSelect: (id: NodeId | null) => void;
  onMove: (id: NodeId, dx: number, dy: number) => void;
  onConnect: (from: NodeId, port: string, to: NodeId) => void;
  /** Текущий масштаб наружу: редактор кладёт новую ноду в видимый угол и считает его в поле. */
  onZoom?: (zoom: number) => void;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);
  // Окно прокрутки нужно и здесь (масштаб, панорама), и редактору (куда класть новую ноду).
  // Свой ref, а не `scrollRef ?? ownView`: у такого объединения компилятор React не видит, что это
  // ref, и снимает мемоизацию со всего компонента. Чужой ref заполняется тут же, на элементе.
  const view = useRef<HTMLDivElement>(null);
  const [wire, setWire] = useState<Wire | null>(null);
  const [zoom, setZoom] = useState(1);
  const [expanded, setExpanded] = useState(false);
  // Тот же масштаб, но читаемый из обработчиков без пересоздания колбэков.
  const zoomNow = useRef(1);
  // Куда прокрутить ПОСЛЕ смены масштаба. Прямо в обработчике этого делать нельзя: поле ещё
  // прежнего размера, и браузер обрежет прокрутку по старому пределу — «вписать» промахивался
  // ровно поэтому.
  const pending = useRef<{ x: number; y: number } | null>(null);
  // Точка графа в середине окна — запоминается перед разворотом, возвращается после него.
  const center = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => onZoom?.(zoom), [zoom, onZoom]);

  useEffect(() => {
    const el = view.current;
    const to = pending.current;
    pending.current = null;
    if (!el || !to) return;
    el.scrollLeft = to.x;
    el.scrollTop = to.y;
  }, [zoom]);

  const toField = useCallback(
    (clientX: number, clientY: number) => {
      const box = fieldRef.current?.getBoundingClientRect();
      // Прямоугольник уже масштабирован, поэтому смещение от его угла делим на масштаб.
      return { x: (clientX - (box?.left ?? 0)) / zoom, y: (clientY - (box?.top ?? 0)) / zoom };
    },
    [zoom],
  );

  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  const width = Math.max(...graph.nodes.map((n) => (n.x ?? 0) + NODE_W), 600) + MARGIN;
  const height = Math.max(...graph.nodes.map((n) => (n.y ?? 0) + nodeHeight(n)), 400) + MARGIN;

  /** Масштаб с сохранением точки под курсором — иначе колесо уводит граф из-под руки. */
  const zoomAt = useCallback((next: number, clientX?: number, clientY?: number) => {
    const el = view.current;
    const prev = zoomNow.current;
    const z = clampZoom(next);
    if (!el || z === prev) return;
    const box = el.getBoundingClientRect();
    const ax = (clientX ?? box.left + box.width / 2) - box.left;
    const ay = (clientY ?? box.top + box.height / 2) - box.top;
    const fx = (el.scrollLeft + ax) / prev;
    const fy = (el.scrollTop + ay) / prev;
    pending.current = { x: fx * z - ax, y: fy * z - ay };
    zoomNow.current = z;
    setZoom(z);
  }, []);

  /** «Вписать»: весь граф целиком в окно — то, ради чего масштаб и заводился. */
  const fit = useCallback(() => {
    const el = view.current;
    if (!el || !graph.nodes.length) return;
    const minX = Math.min(...graph.nodes.map((n) => n.x ?? 0));
    const minY = Math.min(...graph.nodes.map((n) => n.y ?? 0));
    const maxX = Math.max(...graph.nodes.map((n) => (n.x ?? 0) + NODE_W));
    const maxY = Math.max(...graph.nodes.map((n) => (n.y ?? 0) + nodeHeight(n)));
    const pad = 40;
    const z = clampZoom(Math.min((el.clientWidth - pad * 2) / (maxX - minX), (el.clientHeight - pad * 2) / (maxY - minY), 1));
    const to = { x: minX * z - pad, y: minY * z - pad };
    // Масштаб уже тот же — ждать перерисовки нечего, едем сразу.
    if (z === zoomNow.current) {
      el.scrollLeft = to.x;
      el.scrollTop = to.y;
      return;
    }
    pending.current = to;
    zoomNow.current = z;
    setZoom(z);
  }, [graph.nodes]);


  // Разворот и сворачивание меняют размер окна канваса — граф показывается заново. Иначе после
  // разворота видно ровно тот же угол, что и в маленьком окне, и человек первым делом жмёт
  // «Вписать» руками. Граф при переезде в портал перерисовывается с нуля, прокрутка всё равно
  // сбрасывается — так пусть сбрасывается осмысленно.
  useEffect(() => {
    // Разворот переносит канвас в портал, и вся его разметка создаётся заново — прокрутка
    // обнуляется. Возвращаем взгляд на ту же точку графа: масштаб человек выбрал сам, меняется
    // только размер окна, поэтому «вписать» тут было бы самоуправством.
    const el = view.current;
    const at = center.current;
    center.current = null;
    if (!el || !at) return;
    el.scrollLeft = at.x * zoomNow.current - el.clientWidth / 2;
    el.scrollTop = at.y * zoomNow.current - el.clientHeight / 2;
  }, [expanded]);

  // Колесо с Ctrl/⌘ — масштаб, без него обычная прокрутка. Слушатель свой, а не `onWheel`:
  // React вешает колесо пассивно, и отменить прокрутку страницы из него нельзя.
  useEffect(() => {
    const el = view.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomAt(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [zoom, zoomAt]);

  // Развёрнутый канвас закрывается Esc: он лежит поверх страницы, и мышью до кнопки ещё надо дойти.
  // Заодно страница под ним замирает: иначе колесо, доехав до края поля, продолжает катить её —
  // человек правит граф, а под оверлеем уезжает вся вкладка.
  useEffect(() => {
    if (!expanded) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    const back = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = back;
      window.removeEventListener("keydown", esc);
    };
  }, [expanded]);

  // Протяжка связи слушает окно, а не карточку: курсор уходит с ноды на первом же пикселе,
  // и события на самой ноде закончились бы ровно там, где связь только начинается.
  useEffect(() => {
    if (!wire) return;
    const move = (e: PointerEvent) => {
      const p = toField(e.clientX, e.clientY);
      setWire((w) => (w ? { ...w, x: p.x, y: p.y } : w));
    };
    const up = (e: PointerEvent) => {
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const card = under?.closest("[data-flow-node]");
      const to = card?.getAttribute("data-flow-node");
      // Отпустили мимо ноды — связь просто не создалась. Снимать существующую промахом нельзя:
      // «отменить» и «стереть» должны быть разными жестами, стирает инспектор.
      if (to) onConnect(wire.from, wire.port, to);
      setWire(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [wire, toField, onConnect]);

  /** Панорама: тянем пустое поле — едет вид. Клик без движения по-прежнему снимает выделение. */
  const startPan = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return;
    const el = view.current;
    if (!el) return;
    const from = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
    let moved = false;
    const move = (m: PointerEvent) => {
      const dx = m.clientX - from.x;
      const dy = m.clientY - from.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
      el.scrollLeft = from.left - dx;
      el.scrollTop = from.top - dy;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (!moved) onSelect(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Вход ноды рисуется точкой, как и выход, и точка залита, когда сюда что-то ведёт: правило «у
  // каждой ноды есть вход» видно на канвасе, а не только в списке проверки (`BOT-FLOW-PLAN.md` §2).
  const wired = new Set(graph.nodes.flatMap((n) => portsOf(n).map((p) => p.target).filter((t): t is NodeId => !!t)));

  // Связи, разобранные по тону. Выделенные рисуются последними: в густом месте важно видеть, куда
  // ведёт именно та нода, которую правят.
  const edges: Edge[] = [];
  for (const node of graph.nodes) {
    const ports = portsOf(node);
    ports.forEach((port, i) => {
      const target = port.target ? byId.get(port.target) : null;
      if (!target) return;
      const near = selected === node.id || selected === target.id;
      const passed = (trail?.has(node.id) && trail?.has(target.id)) ?? false;
      // След симулятора перебивает цвет выхода: он про «здесь прошли сейчас», и держится один ход.
      const trailed = passed && !near;
      edges.push({
        key: `${node.id}:${port.key}`,
        d: wirePath(outPoint(node, i), inPoint(target)),
        color: trailed ? TRAIL_LINE : portColor(node.type, i, ports.length),
        // Выделенное толще и плотнее, остальное приглушено: в густом месте важно видеть связи
        // именно той ноды, которую правят.
        width: near || trailed ? 2.6 : 1.8,
        opacity: near || trailed ? 1 : 0.65,
        lift: near || trailed,
      });
    });
  }
  edges.sort((a, b) => Number(a.lift) - Number(b.lift));

  // Выбранная нода рисуется последней: у абсолютных карточек порядок в DOM и есть порядок слоёв,
  // а та, которую правят, должна лежать поверх соседей.
  const drawOrder = [...graph.nodes].sort((a, b) => Number(a.id === selected) - Number(b.id === selected));

  const panel = (
      <div className="relative h-full">
        <div
          ref={(el) => {
            view.current = el;
            if (scrollRef) scrollRef.current = el;
          }}
          className="h-full overflow-auto rounded-card bg-surface-2 cushion-field"
          // Сетка точками: по ней видно и масштаб, и то, что поле продолжается за краем.
          style={{
            backgroundImage: "radial-gradient(var(--line-strong) 1px, transparent 1px)",
            backgroundSize: `${40 * zoom}px ${40 * zoom}px`,
          }}
        >
          <DragBoard
            id="bot-flow-canvas"
            // Смещение броска приезжает в экранных пикселях — в координаты поля его переводит масштаб.
            onDrop={(from, _to, delta) => onMove(from, delta.x / zoom, delta.y / zoom)}
          >
            {/* Внешний слой размером с масштабированное поле: `scale` не меняет место, которое
                занимает элемент, и без него прокрутка считала бы поле по-старому. */}
            <div style={{ width: width * zoom, height: height * zoom }}>
              <div
                ref={fieldRef}
                style={{ width, height, transform: `scale(${zoom})`, transformOrigin: "0 0" }}
                className="relative"
                onPointerDown={startPan}
              >
                <svg width={width} height={height} className="pointer-events-none absolute inset-0">
                  {/* Наконечник — свой на каждый встреченный цвет: маркер не наследует обводку. */}
                  <defs>
                    {[...new Set([TRAIL_LINE, ...edges.map((e) => e.color)])].map((color) => (
                      <marker
                        key={color}
                        id={markerId(color)}
                        viewBox="0 0 8 8"
                        refX={7}
                        refY={4}
                        markerWidth={7}
                        markerHeight={7}
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 1 L 8 4 L 0 7 z" fill={color} />
                      </marker>
                    ))}
                  </defs>
                  {edges.map((edge) => (
                    <path
                      key={edge.key}
                      d={edge.d}
                      fill="none"
                      strokeLinecap="round"
                      stroke={edge.color}
                      strokeWidth={edge.width}
                      strokeOpacity={edge.opacity}
                      markerEnd={`url(#${markerId(edge.color)})`}
                    />
                  ))}
                  {/* Связь, которую сейчас тянут: пунктиром от выхода к курсору. */}
                  {wire &&
                    (() => {
                      const from = byId.get(wire.from);
                      const i = from ? portsOf(from).findIndex((p) => p.key === wire.port) : -1;
                      if (!from || i < 0) return null;
                      const a = outPoint(from, i);
                      return (
                        <path
                          d={wirePath(a, { x: wire.x, y: wire.y })}
                          stroke={portColor(from.type, i, portsOf(from).length)}
                          strokeWidth={2}
                          strokeDasharray="6 4"
                          fill="none"
                        />
                      );
                    })()}
                </svg>

                {drawOrder.map((node) => (
                  <div key={node.id} style={{ position: "absolute", left: node.x ?? 0, top: node.y ?? 0, width: NODE_W }}>
                    <NodeCard
                      node={node}
                      start={graph.start === node.id}
                      selected={selected === node.id}
                      wired={wired.has(node.id)}
                      mark={marks?.get(node.id)}
                      active={active === node.id}
                      passed={trail?.has(node.id) ?? false}
                      scale={zoom}
                      onSelect={() => onSelect(node.id)}
                      onWire={(port, e) => {
                        const p = toField(e.clientX, e.clientY);
                        setWire({ from: node.id, port, x: p.x, y: p.y });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </DragBoard>
        </div>

        {/* Пульт лежит поверх окна, а не внутри прокрутки: он нужен там же, где взгляд, в любом
            месте графа. */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-control bg-surface px-1.5 py-1 font-pouf cushion-row">
          <Button size="xs" variant="quiet" title="Мельче (Ctrl+колесо)" onClick={() => zoomAt(zoom - ZOOM_STEP)}>
            −
          </Button>
          <button
            type="button"
            title="Вернуть 100%"
            onClick={() => zoomAt(1)}
            className="min-w-[3rem] cursor-pointer border-none bg-transparent text-xs font-black text-muted"
          >
            {Math.round(zoom * 100)}%
          </button>
          <Button size="xs" variant="quiet" title="Крупнее (Ctrl+колесо)" onClick={() => zoomAt(zoom + ZOOM_STEP)}>
            +
          </Button>
          <Button size="xs" variant="quiet" title="Показать весь граф целиком" onClick={fit}>
            Вписать
          </Button>
          <Button
            size="xs"
            variant={expanded ? "solid" : "quiet"}
            title={expanded ? "Свернуть (Esc)" : "Развернуть на весь экран"}
            onClick={() => {
              const el = view.current;
              if (el) {
                center.current = {
                  x: (el.scrollLeft + el.clientWidth / 2) / zoomNow.current,
                  y: (el.scrollTop + el.clientHeight / 2) / zoomNow.current,
                };
              }
              setExpanded((v) => !v);
            }}
          >
            {expanded ? "Свернуть" : "Развернуть"}
          </Button>
        </div>
      </div>
  );

  return (
    <>
      {/* Место в потоке остаётся занятым всегда: развёрнутый канвас уезжает в портал на body, и
          без заглушки соседние панели подпрыгнули бы вверх, а по возвращении съехали обратно. */}
      <div className="h-[72vh] min-h-[30rem]">
        {expanded ? (
          <div className="grid h-full place-items-center rounded-card bg-surface-2 font-pouf cushion-field">
            <p className="text-xs font-bold text-muted">Канвас развёрнут поверх страницы · Esc — вернуть сюда</p>
          </div>
        ) : (
          panel
        )}
      </div>
      {/* Портал на body, а не `fixed` внутри страницы: так оверлей не зависит от того, что над ним
          в разметке (у предка с `transform` `fixed` считается от предка, а не от окна). */}
      {expanded &&
        createPortal(
          <div className="fixed inset-0 z-50 bg-bg/85 p-3 backdrop-blur-sm">{panel}</div>,
          document.body,
        )}
    </>
  );
}

function NodeCard({
  node,
  start,
  selected,
  wired,
  mark,
  active,
  passed,
  scale,
  onSelect,
  onWire,
}: {
  node: FlowNode;
  start: boolean;
  selected: boolean;
  /** Ведёт ли сюда хоть один переход — от этого залита точка входа. */
  wired: boolean;
  mark?: FlowIssueLevel;
  active: boolean;
  passed: boolean;
  /** Масштаб канваса: карточка едет за курсором внутри масштабированного поля. */
  scale: number;
  onSelect: () => void;
  onWire: (port: string, e: React.PointerEvent) => void;
}) {
  const ports = portsOf(node);
  const tone = NODE_TONE[node.type];
  // Три обводки об одном и том же прямоугольнике: что правят (внутрь), где стоит симулятор и через
  // что он прошёл (наружу). Стилем, а не классами: цвета берутся из токенов и смешиваются.
  const rings: string[] = [];
  if (selected) rings.push("inset 0 0 0 2px var(--color-accent)");
  if (active) rings.push("0 0 0 3px var(--color-ok-ink)");
  else if (passed) rings.push("0 0 0 2px color-mix(in srgb, var(--color-ok-ink) 40%, transparent)");

  return (
    <DragCard id={node.id} follow scale={scale} onTap={onSelect}>
      <div
        data-flow-node={node.id}
        style={{ height: nodeHeight(node), boxShadow: rings.length ? rings.join(", ") : undefined }}
        className="relative overflow-hidden rounded-control"
      >
        {/* Полоска цвета типа у левого края: значок читается вблизи, полоска — на общем плане. */}
        <span style={{ background: tone.fill }} className="absolute inset-y-0 left-0 w-1" />
        <div style={{ height: HEAD_H }} className="flex items-center gap-1.5 pl-2 pr-2.5">
          {/* Точка входа. У ноды-входа её нет по правилу: в неё входят снаружи, из телеграма. */}
          <span
            title={node.type === "start" ? "Вход снаружи: /start" : wired ? "Сюда ведёт переход" : "Ни один переход сюда не ведёт"}
            style={node.type !== "start" && wired ? { background: tone.line } : undefined}
            className={`h-3.5 w-3.5 shrink-0 rounded-pill ${
              node.type === "start" || wired ? "" : "bg-surface-3 [box-shadow:inset_0_0_0_2px_var(--line-strong)]"
            }`}
          />
          <span
            style={{ background: tone.fill, color: tone.ink }}
            className="shrink-0 rounded-pill px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.4px]"
          >
            {TYPE_LABEL[node.type]}
          </span>
          {start && <span className="shrink-0 text-[10px] font-black uppercase text-accent-bright">старт</span>}
          {mark && (
            <span
              title={mark === "error" ? "Проверка: ошибка" : "Проверка: предупреждение"}
              className="grid h-4 w-4 shrink-0 place-items-center rounded-pill text-[10px] font-black"
              style={{
                backgroundImage: mark === "error" ? "var(--grad-err)" : "var(--grad-warn)",
                color: mark === "error" ? "var(--color-err-ink)" : "var(--color-warn-ink)",
              }}
            >
              !
            </span>
          )}
          <span className="min-w-0 truncate text-[12px] font-black text-ink">{node.title || node.id}</span>
        </div>
        <div style={{ height: BODY_H }} className="px-2.5">
          <p className="truncate text-[11px] font-bold leading-[1.5] text-muted">{preview(node)}</p>
          <p className="truncate text-[10px] font-bold text-muted opacity-70">{node.id}</p>
        </div>
        {ports.map((port, i) => (
          <PortRow key={port.key} port={port} color={portColor(node.type, i, ports.length)} onWire={onWire} />
        ))}
      </div>
    </DragCard>
  );
}

function PortRow({
  port,
  color,
  onWire,
}: {
  port: FlowPort;
  /** Цвет ЭТОГО выхода — тот же, которым уходит его связь: строка и линия ищут друг друга глазами. */
  color: string;
  onWire: (port: string, e: React.PointerEvent) => void;
}) {
  return (
    <div style={{ height: PORT_H }} className="flex items-center justify-end gap-1.5 pl-2.5 pr-1">
      <span
        style={port.target ? { color } : undefined}
        className={`min-w-0 truncate text-[11px] font-extrabold ${
          port.target ? "" : port.kind === "button" ? "text-ink" : "text-muted"
        }`}
        title={port.label}
      >
        {port.kind === "button" ? `«${port.label}»` : port.label}
      </span>
      {/* Кружок — и ручка связи, и её индикатор: залит, когда выход куда-то ведёт.
          `stopPropagation` обязателен: без него нажатие на кружок начало бы ещё и перетаскивание
          ноды, потому что слушатели dnd-kit висят на карточке выше. */}
      <button
        type="button"
        aria-label={`Связь: ${port.label}`}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onWire(port.key, e);
        }}
        style={port.target ? { background: color } : undefined}
        className={`h-3.5 w-3.5 shrink-0 cursor-crosshair rounded-pill border-none ${
          port.target ? "" : "bg-surface-3 [box-shadow:inset_0_0_0_2px_var(--line-strong)]"
        }`}
      />
    </div>
  );
}
