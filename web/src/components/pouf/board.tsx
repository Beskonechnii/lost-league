"use client";

import { useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

/* Зона drag-n-drop, вторая половина артборда Кита: «пул слева — слоты справа».
 * Первая половина (файловая) живёт рядом, в `dropzone.tsx`.
 *
 * Заводится на Э11, а не на Э9, ровно по причине из плана: пока случаев было
 * два, общий атом пришлось бы угадывать. К Э11 их три и они дали границу:
 *
 *   · доска заявки (`tournaments/<slug>/apply`) — пул игроков лиги → восемь
 *     именованных слотов состава;
 *   · драфт UNDERBEER — пул по позициям → N колонок команд;
 *   · жеребьёвка того же драфта в фазе настройки — тот же пул → та же колонка,
 *     но бросок означает «капитан», а не «пик».
 *
 * Общего у них НЕ логика (кто куда может попасть — правило экрана, и правила
 * эти разные) и НЕ раскладка (слева/справа против сверху/снизу). Общими
 * оказались ровно три вещи, и атом отвечает только за них:
 *
 *   1. техника: один порог срыва (6px — иначе клик по карточке превращается в
 *      микро-перетаскивание и «поставить нажатием» перестаёт работать), одна
 *      «летящая» карточка, один способ узнать, что бросили и куда;
 *   2. вид перетаскиваемого: приподнятая подушка, которая гаснет, когда взять
 *      нельзя, и почти исчезает, пока её несут;
 *   3. вид цели: пустая — вдавленная лунка, занятая — подушка, под курсором с
 *      грузом — акцентная. Форма, а не подпись, говорит «сюда можно».
 *
 * Что цель рисует ВНУТРИ себя, атом не знает: в заявке это строка слота, в
 * драфте — целая колонка команды с шапкой и составом. Поэтому цель отдана
 * хуком (`useDropTarget`), а не компонентом с фиксированной разметкой.
 */

/**
 * Оболочка доски: контекст перетаскивания и «летящая» карточка.
 *
 * `id` обязателен: без него dnd-kit генерит его сам и на гидрации серверный
 * идентификатор не сходится с клиентским.
 *
 * `onDrop` получает СТРОКОВЫЕ идентификаторы, а не разобранные сущности —
 * что означает `pool:12` или `team:a`, знает экран, и разбор префиксов лежит
 * там же, где правила.
 */
export function DragBoard({
  id,
  onDrop,
  overlay,
  children,
}: {
  id: string;
  /** Бросок: откуда тащили и над чем отпустили (`null` — мимо любой цели). */
  onDrop: (from: string, to: string | null) => void;
  /** Что показать в «летящей» карточке. Отсутствует — доска тащит без превью. */
  overlay?: (from: string) => ReactNode;
  children: ReactNode;
}) {
  const [from, setFrom] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  return (
    <DndContext
      id={id}
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => setFrom(String(e.active.id))}
      onDragCancel={() => setFrom(null)}
      onDragEnd={(e: DragEndEvent) => {
        setFrom(null);
        onDrop(String(e.active.id), e.over ? String(e.over.id) : null);
      }}
    >
      {children}
      {/* Ширину «летящей» карточке задаёт доска, а не место, откуда её взяли:
          строка пула и строка слота разной ширины, и без фиксации карточка
          прыгала бы в размере ровно в момент отрыва. */}
      <DragOverlay>
        {from && overlay ? (
          <div className="w-64 max-w-[80vw] rounded-control bg-surface font-pouf opacity-95 cushion-row-hover">
            {overlay(from)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/**
 * Перетаскиваемая карточка пула или слота.
 *
 * `muted` — «взять нельзя»: карточка не тащится, но остаётся на месте и
 * гаснет. Это видимое состояние, а не запрет мышью: человек должен понимать,
 * почему игрок не берётся, ещё до попытки его взять.
 */
export function DragCard({
  id,
  muted = false,
  bare = false,
  onTap,
  title,
  children,
}: {
  id: string;
  muted?: boolean;
  /** Карточка уже лежит внутри подушки цели — своей она не носит, иначе подушка на подушке. */
  bare?: boolean;
  /** Поставить нажатием — второй способ того же действия, для узкого экрана. */
  onTap?: () => void;
  title?: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, disabled: muted });
  // `bare` живёт внутри чужой подушки, поэтому своей поверхности не носит НИ в каком состоянии:
  // «взять нельзя» у него читается тем, что карточка просто не берётся, а не заливкой.
  const skin = bare
    ? `min-w-0 flex-1 ${muted ? "" : "cursor-grab active:cursor-grabbing"}`
    : muted
      ? "bg-surface-2 opacity-55 cushion-field"
      : `bg-surface cushion-row hover:-translate-y-px hover:cushion-row-hover active:translate-y-px active:cursor-grabbing ${
          onTap ? "cursor-pointer" : "cursor-grab"
        }`;
  return (
    <div
      ref={setNodeRef}
      {...(muted ? {} : { ...listeners, ...attributes })}
      onClick={muted ? undefined : onTap}
      title={title}
      className={`rounded-control font-pouf transition-[box-shadow,transform,opacity] ${skin} ${
        isDragging ? "opacity-30" : ""
      }`}
    >
      {children}
    </div>
  );
}

/**
 * Цель броска: ref и признак «над ней сейчас держат груз».
 *
 * Хук, а не компонент: целью бывает и строка слота, и целая колонка команды —
 * общей разметки у них нет, общее только поведение.
 */
export function useDropTarget(id: string, disabled = false) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled });
  return { ref: setNodeRef, isOver };
}

/**
 * Вдавленная дорожка, в которой лежат карточки пула: приподнятые строки должны
 * лежать ВНУТРИ лунки, а не парить на бумаге. Высота ограничена — иначе двести
 * человек уводят цели за нижний край экрана.
 */
export function BoardLane({
  max = "30rem",
  children,
}: {
  /** Предел высоты дорожки; дальше — прокрутка внутри лунки. */
  max?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{ maxHeight: max }}
      className="space-y-1.5 overflow-y-auto rounded-blob bg-surface-2 p-2 font-pouf cushion-field [scrollbar-color:var(--color-surface-3)_transparent] [scrollbar-width:thin]"
    >
      {children}
    </div>
  );
}

/**
 * Классы цели: пустая — лунка, занятая — подушка, под грузом — акцентная.
 * Отдаётся функцией, потому что саму разметку цели рисует экран.
 */
export function dropClasses({ isOver, filled = false }: { isOver: boolean; filled?: boolean }) {
  if (isOver) return "bg-accent-fill/60 cushion-blob";
  return filled ? "bg-surface cushion-row" : "bg-surface-2 cushion-field";
}
