"use client";

import { useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, EyeIcon, EyeOffIcon, TrashIcon } from "lucide-react";
import { Label } from "@/app/_components/form";
import { FormInput } from "@/components/pouf/Input";
import { IconButton } from "@/components/pouf/Button";
import type { Element } from "./model";

// Панель слоёв: список элементов сверху-вниз по z-order (верхний слой — первым). Клик выделяет,
// глаз скрывает/показывает, корзина удаляет, стрелки двигают по слоям. Иерархия = порядок в списке.

export function LayersPanel({
  elements,
  selectedId,
  onSelect,
  onToggleHidden,
  onRemove,
  onOrder,
  onRename,
}: {
  elements: Element[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleHidden: (id: string, hidden: boolean) => void;
  onRemove: (id: string) => void;
  onOrder: (id: string, dir: "up" | "down") => void;
  onRename: (id: string, name: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // в документе последний элемент рисуется поверх → в списке показываем в обратном порядке
  const rows = [...elements].reverse();

  function commit(id: string) {
    onRename(id, draft.trim());
    setEditing(null);
  }

  return (
    <div>
      <Label>Слои</Label>
      {rows.length === 0 ? (
        <p className="mt-1 text-xs text-ink-subtle">Пока пусто.</p>
      ) : (
        <ul className="scroll-dark mt-1 max-h-64 space-y-1 overflow-y-auto pr-1">
          {rows.map((el) => (
            <li
              key={el.id}
              onClick={() => onSelect(el.id)}
              className={`group flex items-center gap-1.5 rounded px-2 py-1 text-sm ${
                el.id === selectedId ? "bg-accent/15 text-accent-bright" : "text-ink-muted hover:bg-surface-2"
              } ${el.hidden ? "opacity-50" : ""}`}
            >
              <IconButton
                type="button"
                size="xs"
                label={el.hidden ? "Показать" : "Скрыть"}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleHidden(el.id, !el.hidden);
                }}
                className="shrink-0"
                icon={el.hidden ? <EyeOffIcon /> : <EyeIcon />}
              />
              {editing === el.id ? (
                <FormInput
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={() => commit(el.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit(el.id);
                    else if (e.key === "Escape") setEditing(null);
                  }}
                  className="h-6 min-w-0 flex-1 px-1 py-0 text-sm"
                />
              ) : (
                <span
                  className="min-w-0 flex-1 truncate"
                  title="Двойной клик — переименовать"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setDraft(el.name ?? "");
                    setEditing(el.id);
                  }}
                >
                  {layerName(el)}
                </span>
              )}
              {/* Действия по слою — по наведению или у выделенного; иначе имя занимает всю строку */}
              <div
                className={`shrink-0 items-center gap-0.5 ${
                  el.id === selectedId ? "flex" : "hidden group-hover:flex"
                }`}
              >
                <IconButton
                  type="button"
                  size="xs"
                  label="Выше"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOrder(el.id, "up");
                  }}
                  icon={<ArrowUpIcon />}
                />
                <IconButton
                  type="button"
                  size="xs"
                  label="Ниже"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOrder(el.id, "down");
                  }}
                  icon={<ArrowDownIcon />}
                />
                <IconButton
                  type="button"
                  size="xs" tone="down"
                  label="Удалить"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(el.id);
                  }}
                  icon={<TrashIcon />}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function layerName(el: Element): string {
  if (el.name?.trim()) return el.name;
  if (el.type === "text") return el.text.trim() ? `Текст: ${el.text}` : "Текст";
  if (el.type === "image") return "Картинка";
  return el.type === "rect" ? "Прямоугольник" : "Эллипс";
}
