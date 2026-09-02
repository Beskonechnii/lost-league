"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/pouf/Button";
import { FormInput } from "@/components/pouf/Input";
import { Alert } from "@/components/pouf/feedback";
import { Panel } from "@/app/(admin)/_components/panel";
import { NODE_KINDS, freeNodeId, makeNode, removeNode, setPort } from "@/lib/bot-flow/editor";
import type { FlowVersion } from "@/lib/bot-flow/store";
import { hasErrors, marksByNode, validateFlow, type FlowRegistries } from "@/lib/bot-flow/validate";
import { parseGraph, type BotFlowGraph, type FlowNode, type FlowNodeType, type NodeId } from "@/lib/bot-flow/types";
import { editFlowVersion, publishFlowDraft, resetFlowDraft, rollbackFlow, saveFlowDraft, type FlowResult } from "../actions";
import { FlowCanvas } from "./flow-canvas";
import { FlowCheck } from "./flow-check";
import { FlowInspector } from "./flow-inspector";
import { FlowSim } from "./flow-sim";
import { FlowVersions } from "./flow-versions";

/* Редактор графа диалога: канвас, палитра, инспектор и версии в одном состоянии.
 *
 * Граф целиком лежит здесь и правится только в памяти — на сервер он уезжает целым документом по
 * кнопке. Это прямое следствие решения «граф хранится JSON-документом, а не таблицами нод и
 * рёбер» (`BOT-FLOW-PLAN.md` §2): каждое перетаскивание ноды иначе было бы записью в базу.
 *
 * Отсюда же «черновик» как отдельная сущность: правки копятся в строке `draft`, а бот продолжает
 * говорить опубликованной версией, пока оператор не нажмёт «В эфир».
 */

/** Что за граф сейчас на экране — редактор говорит это вслух, чтобы «сохранить» не было сюрпризом. */
const SOURCE: Record<"draft" | "live" | "seed", string> = {
  draft: "открыт черновик — в эфире пока прежняя версия",
  live: "открыта версия из эфира; первое сохранение заведёт черновик",
  seed: "открыт дефолтный граф из кода: сохранённых версий ещё нет",
};

/** Шаг сетки: ноды выравниваются сами, иначе канвас через неделю выглядит как рассыпанные карты. */
const GRID = 10;
const snap = (v: number) => Math.max(0, Math.round(v / GRID) * GRID);

export function FlowEditor({
  initialGraph,
  initialNote,
  source,
  versions,
  registries,
}: {
  initialGraph: BotFlowGraph;
  initialNote: string;
  /** Откуда открылся редактор: черновик, живая версия или сид из кода. */
  source: "draft" | "live" | "seed";
  versions: FlowVersion[];
  /** Что существует: `ctx.*`, `settings.*`, действия. Приезжает с сервера — их реестры тянут prisma. */
  registries: FlowRegistries;
}) {
  const router = useRouter();
  const [graph, setGraph] = useState<BotFlowGraph>(initialGraph);
  const [note, setNote] = useState(initialNote);
  const [selected, setSelected] = useState<NodeId | null>(null);
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState<FlowResult | null>(null);
  const [busy, startTransition] = useTransition();
  // Где стоит симулятор и через что он прошёл последним ходом — канвас подсвечивает это на карточках.
  const [trace, setTrace] = useState<{ active: NodeId | null; trail: Set<NodeId> }>({ active: null, trail: new Set() });
  const viewRef = useRef<HTMLDivElement>(null);

  // Проверка идёт на каждой правке прямо в браузере: она чистая арифметика по документу, и ходить
  // за ней на сервер значило бы ждать ответа после каждого перетаскивания. Сервер проверит ещё раз
  // при публикации — там решение, а здесь подсказка.
  const issues = useMemo(() => validateFlow(graph, registries), [graph, registries]);
  const blocked = hasErrors(issues);
  const marks = useMemo(() => marksByNode(issues), [issues]);

  // Несохранённый граф живёт только в памяти вкладки: закрыть её молча — потерять работу.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const edit = useCallback((next: (g: BotFlowGraph) => BotFlowGraph) => {
    setGraph((g) => next(g));
    setDirty(true);
    setResult(null);
  }, []);

  const putNode = useCallback(
    (next: FlowNode) => edit((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === next.id ? next : n)) })),
    [edit],
  );

  const move = useCallback(
    (id: NodeId, dx: number, dy: number) =>
      edit((g) => ({
        ...g,
        nodes: g.nodes.map((n) => (n.id === id ? { ...n, x: snap((n.x ?? 0) + dx), y: snap((n.y ?? 0) + dy) } : n)),
      })),
    [edit],
  );

  const connect = useCallback(
    (from: NodeId, port: string, to: NodeId) =>
      edit((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === from ? setPort(n, port, to) : n)) })),
    [edit],
  );

  const add = (type: FlowNodeType) => {
    // Кладём в левый верхний угол того, что сейчас видно: нода, появившаяся за краем прокрутки,
    // выглядит как «кнопка не сработала». Занятое место обходим лесенкой вправо-вниз.
    const view = viewRef.current;
    let x = snap((view?.scrollLeft ?? 0) + 40);
    let y = snap((view?.scrollTop ?? 0) + 40);
    while (graph.nodes.some((n) => Math.abs((n.x ?? 0) - x) < 120 && Math.abs((n.y ?? 0) - y) < 80)) {
      x += 30;
      y += 30;
    }
    const id = freeNodeId(graph, type);
    edit((g) => ({ ...g, nodes: [...g.nodes, makeNode(type, id, x, y)] }));
    setSelected(id);
  };

  const run = (action: () => Promise<FlowResult>) =>
    startTransition(async () => {
      const res = await action();
      setResult(res);
      if ("error" in res) return;
      // Сервер подменил черновик (взяли старую версию, вернули дефолт) — забираем его документ:
      // граф живёт в состоянии редактора, и router.refresh() сам его не заменит.
      if (res.graph) {
        const next = parseGraph(res.graph);
        if (next) {
          setGraph(next);
          setSelected(null);
        }
      }
      setDirty(false);
      router.refresh();
    });

  const json = () => JSON.stringify(graph);
  const node = graph.nodes.find((n) => n.id === selected) ?? null;

  return (
    <div className="mt-6 font-pouf">
      <Panel>
        <div className="flex flex-wrap items-center gap-2">
          <FormInput
            size="sm"
            className="min-w-[12rem] flex-1"
            value={note}
            placeholder="Подпись версии — по чему её узнать в списке"
            onChange={(e) => setNote(e.target.value)}
          />
          <Button size="sm" variant="quiet" disabled={busy} onClick={() => run(() => saveFlowDraft(json(), note))}>
            Сохранить черновик
          </Button>
          {/* Кнопка гаснет при ошибках проверки, но экшен всё равно проверяет сам: экран мог быть
              отрисован до правки, а в эфир уходит присланный документ. */}
          <Button
            size="sm"
            disabled={busy || blocked}
            title={blocked ? "Сначала исправьте ошибки проверки" : undefined}
            onClick={() => run(() => publishFlowDraft(json(), note))}
          >
            В эфир
          </Button>
        </div>
        <p className="mt-2 text-xs font-bold text-muted">
          {SOURCE[source]}
          {dirty ? " · есть несохранённые правки" : ""}
          {blocked ? " · проверка не пройдена: в эфир нельзя" : ""}
        </p>
        {result && (
          <Alert tone={"error" in result ? "err" : "ok"} block className="mt-3">
            {"error" in result ? result.error : result.ok}
          </Alert>
        )}
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {NODE_KINDS.map((k) => (
              <Button key={k.type} size="xs" variant="quiet" onClick={() => add(k.type)}>
                <span title={k.hint}>+ {k.label}</span>
              </Button>
            ))}
          </div>
          <FlowCanvas
            graph={graph}
            scrollRef={viewRef}
            selected={selected}
            marks={marks}
            active={trace.active}
            trail={trace.trail}
            onSelect={setSelected}
            onMove={move}
            onConnect={connect}
          />
          <p className="text-xs font-bold leading-[1.5] text-muted">
            Ноду двигают перетаскиванием, связь тянут от кружка справа до любой ноды. Отпустили мимо — ничего не
            изменилось; чтобы связь снять, поставьте выходу «наружу» в инспекторе. Кружок слева от типа — вход ноды:
            залит, когда сюда что-то ведёт.
          </p>

          <Panel
            title={`Проверка${issues.length ? ` · ${issues.length}` : ""}`}
            hint="Ошибки не пускают граф в эфир, предупреждения пускают. Строка выделяет ноду на канвасе."
          >
            <FlowCheck issues={issues} onSelect={setSelected} />
          </Panel>
        </div>

        <div className="min-w-0 space-y-4">
          <Panel title="Нода">
            <div className="max-h-[60vh] overflow-y-auto pr-1">
              <FlowInspector
                node={node}
                graph={graph}
                ctxKeys={registries.ctxKeys ?? []}
                settingKeys={registries.settingKeys ?? []}
                onChange={putNode}
                onDelete={() => {
                  if (!node) return;
                  edit((g) => removeNode(g, node.id));
                  setSelected(null);
                }}
                onMakeStart={() => node && edit((g) => ({ ...g, start: node.id }))}
              />
            </div>
          </Panel>

          <Panel
            title="Симулятор"
            hint="Прогон диалога прямо по графу с экрана: в телеграм ничего не уходит, сессия бота не трогается."
          >
            <FlowSim graph={graph} onTrace={(active, trail) => setTrace({ active, trail: new Set(trail) })} />
          </Panel>

          <Panel
            title="Версии"
            hint="Откат — публикация уже существующей версии. Версии не удаляются: сессия доигрывает на своей."
            aside={
              <Button size="xs" variant="quiet" disabled={busy} onClick={() => run(resetFlowDraft)}>
                Дефолт из кода
              </Button>
            }
          >
            <FlowVersions
              versions={versions}
              busy={busy}
              onRollback={(id) => run(() => rollbackFlow(id))}
              onEdit={(id) => run(() => editFlowVersion(id))}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}
