"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DragBoard, DragCard } from "@/components/pouf/board";
import { portsOf, type FlowPort } from "@/lib/bot-flow/editor";
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
 */

export const NODE_W = 232;
const HEAD_H = 30;
const BODY_H = 34;
const PORT_H = 24;
const PAD = 10;
/** Запас поля вокруг самой дальней ноды — чтобы всегда было куда двигать и что класть. */
const MARGIN = 480;

export const nodeHeight = (node: FlowNode): number => HEAD_H + BODY_H + portsOf(node).length * PORT_H + PAD;

/** Точка, из которой выходит связь: правый край карточки на уровне своей строки-выхода. */
const outPoint = (node: FlowNode, i: number) => ({
  x: (node.x ?? 0) + NODE_W,
  y: (node.y ?? 0) + HEAD_H + BODY_H + i * PORT_H + PORT_H / 2,
});

/** Точка, в которую связь приходит: левый край чужой карточки на уровне её шапки. */
const inPoint = (node: FlowNode) => ({ x: node.x ?? 0, y: (node.y ?? 0) + HEAD_H / 2 });

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

type Wire = { from: NodeId; port: string; x: number; y: number };

export function FlowCanvas({
  graph,
  scrollRef,
  selected,
  onSelect,
  onMove,
  onConnect,
}: {
  graph: BotFlowGraph;
  /** Прокрутка канваса наружу: по ней редактор кладёт новую ноду туда, что сейчас видно. */
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  selected: NodeId | null;
  onSelect: (id: NodeId | null) => void;
  onMove: (id: NodeId, dx: number, dy: number) => void;
  onConnect: (from: NodeId, port: string, to: NodeId) => void;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const [wire, setWire] = useState<Wire | null>(null);

  const toField = useCallback((clientX: number, clientY: number) => {
    const box = fieldRef.current?.getBoundingClientRect();
    return { x: clientX - (box?.left ?? 0), y: clientY - (box?.top ?? 0) };
  }, []);

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

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const width = Math.max(...graph.nodes.map((n) => (n.x ?? 0) + NODE_W), 600) + MARGIN;
  const height = Math.max(...graph.nodes.map((n) => (n.y ?? 0) + nodeHeight(n)), 400) + MARGIN;

  // Выбранная нода рисуется последней: у абсолютных карточек порядок в DOM и есть порядок слоёв,
  // а та, которую правят, должна лежать поверх соседей.
  const drawOrder = [...graph.nodes].sort((a, b) => Number(a.id === selected) - Number(b.id === selected));

  return (
    <div ref={scrollRef} className="h-[68vh] min-h-[30rem] overflow-auto rounded-card bg-surface-2 cushion-field">
      <DragBoard id="bot-flow-canvas" onDrop={(from, _to, delta) => onMove(from, delta.x, delta.y)}>
        <div
          ref={fieldRef}
          style={{ width, height }}
          className="relative"
          // Клик по пустому полю снимает выделение: инспектор пустеет, и видно, что ничего не правишь.
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) onSelect(null);
          }}
        >
          <svg width={width} height={height} className="pointer-events-none absolute inset-0">
            {graph.nodes.flatMap((node) =>
              portsOf(node).map((port, i) => {
                const target = port.target ? byId.get(port.target) : null;
                if (!target) return null;
                const a = outPoint(node, i);
                const b = inPoint(target);
                return (
                  <path
                    key={`${node.id}:${port.key}`}
                    d={`M ${a.x} ${a.y} C ${a.x + 60} ${a.y}, ${b.x - 60} ${b.y}, ${b.x} ${b.y}`}
                    fill="none"
                    stroke="var(--line-strong)"
                    strokeWidth={2}
                  />
                );
              }),
            )}
            {/* Связь, которую сейчас тянут: пунктиром от выхода к курсору. */}
            {wire && (() => {
              const from = byId.get(wire.from);
              const i = from ? portsOf(from).findIndex((p) => p.key === wire.port) : -1;
              if (!from || i < 0) return null;
              const a = outPoint(from, i);
              return (
                <path
                  d={`M ${a.x} ${a.y} C ${a.x + 60} ${a.y}, ${wire.x - 60} ${wire.y}, ${wire.x} ${wire.y}`}
                  stroke="var(--color-accent)"
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
                onSelect={() => onSelect(node.id)}
                onWire={(port, e) => {
                  const p = toField(e.clientX, e.clientY);
                  setWire({ from: node.id, port, x: p.x, y: p.y });
                }}
              />
            </div>
          ))}
        </div>
      </DragBoard>
    </div>
  );
}

function NodeCard({
  node,
  start,
  selected,
  onSelect,
  onWire,
}: {
  node: FlowNode;
  start: boolean;
  selected: boolean;
  onSelect: () => void;
  onWire: (port: string, e: React.PointerEvent) => void;
}) {
  const ports = portsOf(node);
  return (
    <DragCard id={node.id} follow onTap={onSelect}>
      <div
        data-flow-node={node.id}
        style={{ height: nodeHeight(node) }}
        className={`overflow-hidden rounded-control ${selected ? "[box-shadow:inset_0_0_0_2px_var(--color-accent)]" : ""}`}
      >
        <div style={{ height: HEAD_H }} className="flex items-center gap-1.5 px-2.5">
          <span className="shrink-0 rounded-pill bg-surface-2 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.4px] text-muted">
            {TYPE_LABEL[node.type]}
          </span>
          {start && <span className="shrink-0 text-[10px] font-black uppercase text-accent-bright">старт</span>}
          <span className="min-w-0 truncate text-[12px] font-black text-ink">{node.title || node.id}</span>
        </div>
        <div style={{ height: BODY_H }} className="px-2.5">
          <p className="truncate text-[11px] font-bold leading-[1.5] text-muted">{preview(node)}</p>
          <p className="truncate text-[10px] font-bold text-muted opacity-70">{node.id}</p>
        </div>
        {ports.map((port) => (
          <PortRow key={port.key} port={port} onWire={onWire} />
        ))}
      </div>
    </DragCard>
  );
}

function PortRow({ port, onWire }: { port: FlowPort; onWire: (port: string, e: React.PointerEvent) => void }) {
  return (
    <div style={{ height: PORT_H }} className="flex items-center justify-end gap-1.5 pl-2.5 pr-1">
      <span
        className={`min-w-0 truncate text-[11px] font-extrabold ${port.kind === "button" ? "text-ink" : "text-muted"}`}
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
        className={`h-3.5 w-3.5 shrink-0 cursor-crosshair rounded-pill border-none ${
          port.target ? "bg-accent" : "bg-surface-3 [box-shadow:inset_0_0_0_2px_var(--line-strong)]"
        }`}
      />
    </div>
  );
}
