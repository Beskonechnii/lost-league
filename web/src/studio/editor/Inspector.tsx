"use client";

import { TrashIcon } from "lucide-react";
import { Label, SelectField, TextField } from "@/app/_components/form";
import { Button } from "@/components/pouf/Button";
import { Checkbox } from "@/components/pouf/checkbox";
import { ColorField, NumberField } from "./controls";
import type { FontDef } from "./fonts";
import type { Binding, BindingField, Element } from "./model";

// Правая панель: свойства выделенного элемента. Патчит одно поле — workspace сливает в документ.
// Общие поля (позиция/размер/поворот/прозрачность) сверху, типовые — ниже.

export function Inspector({
  el,
  fonts,
  onChange,
  onRemove,
  onOrder,
}: {
  el: Element | null;
  fonts: FontDef[];
  onChange: (patch: Partial<Element>) => void;
  onRemove: () => void;
  onOrder: (dir: "front" | "back" | "up" | "down") => void;
}) {
  if (!el) {
    return <p className="text-sm text-ink-subtle">Выделите элемент на холсте, чтобы править его свойства.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-ink-subtle">{typeLabel(el)}</span>
        <Button type="button" variant="quiet" size="xs" tone="down" onClick={onRemove}>
          <TrashIcon />
          Удалить
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField label="X" value={el.x} onChange={(v) => onChange({ x: v })} />
        <NumberField label="Y" value={el.y} onChange={(v) => onChange({ y: v })} />
        <NumberField label="Ширина" value={el.w} min={1} onChange={(v) => onChange({ w: v })} />
        <NumberField label="Высота" value={el.h} min={1} onChange={(v) => onChange({ h: v })} />
        <NumberField label="Поворот°" value={el.rotation} onChange={(v) => onChange({ rotation: v })} />
        <NumberField
          label="Прозрачность %"
          value={Math.round(el.opacity * 100)}
          min={0}
          onChange={(v) => onChange({ opacity: Math.min(1, Math.max(0, v / 100)) })}
        />
      </div>

      {el.type === "text" && (
        <div className="space-y-3 border-t border-hairline pt-3">
          <TextField label="Текст" value={el.text} onChange={(v) => onChange({ text: v })} />
          <SelectField
            label="Шрифт"
            value={el.font}
            onChange={(v) => onChange({ font: v })}
            options={fonts.map((f) => ({ value: f.family, label: f.label }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Кегль" value={el.size} min={1} onChange={(v) => onChange({ size: v })} />
            <SelectField
              label="Жирность"
              value={String(el.weight)}
              onChange={(v) => onChange({ weight: Number(v) })}
              options={[
                { value: "400", label: "400 — обычный" },
                { value: "600", label: "600 — полужирный" },
                { value: "700", label: "700 — жирный" },
                { value: "800", label: "800 — чёрный" },
                { value: "900", label: "900 — сверхжирный" },
              ]}
            />
            <NumberField label="Межбуквенный" value={el.letterSpacing} onChange={(v) => onChange({ letterSpacing: v })} />
            <NumberField
              label="Межстрочный"
              value={el.lineHeight}
              step={0.1}
              onChange={(v) => onChange({ lineHeight: v })}
            />
          </div>
          <ColorField label="Цвет" value={el.color} onChange={(v) => onChange({ color: v })} />
          <SelectField
            label="Выравнивание"
            value={el.align}
            onChange={(v) => onChange({ align: v as "left" | "center" | "right" })}
            options={[
              { value: "left", label: "по левому" },
              { value: "center", label: "по центру" },
              { value: "right", label: "по правому" },
            ]}
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
            <Checkbox checked={el.uppercase} onCheckedChange={(v) => onChange({ uppercase: v === true })} />
            ПРОПИСНЫЕ
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
            <Checkbox checked={el.autoFit === true} onCheckedChange={(v) => onChange({ autoFit: v === true })} />
            Вписать в бокс (авто-кегль)
          </label>
        </div>
      )}

      {el.type === "image" && (
        <div className="space-y-3 border-t border-hairline pt-3">
          <SelectField
            label="Вписывание"
            value={el.fit}
            onChange={(v) => onChange({ fit: v as "cover" | "contain" })}
            options={[
              { value: "contain", label: "целиком (contain)" },
              { value: "cover", label: "заполнить (cover)" },
            ]}
          />
          <NumberField label="Скругление" value={el.radius} min={0} onChange={(v) => onChange({ radius: v })} />
        </div>
      )}

      {(el.type === "text" || el.type === "image") && (
        <div className="space-y-2 border-t border-hairline pt-3">
          <SelectField
            label="Данные (шаблон)"
            value={el.binding ? `${el.binding.source}:${el.binding.field}` : ""}
            onChange={(v) => onChange({ binding: parseBinding(v) })}
            options={bindingOptions(el.type)}
          />
          <p className="text-xs text-ink-subtle">
            Привязанный элемент подставится при заполнении серией. Без привязки — рисуется как есть.
          </p>
        </div>
      )}

      {(el.type === "rect" || el.type === "ellipse") && (
        <div className="space-y-3 border-t border-hairline pt-3">
          <ColorField label="Заливка" value={el.fill} onChange={(v) => onChange({ fill: v })} />
          {el.type === "rect" && (
            <NumberField label="Скругление" value={el.radius} min={0} onChange={(v) => onChange({ radius: v })} />
          )}
          <ColorField label="Обводка" value={el.stroke ?? "#000000"} onChange={(v) => onChange({ stroke: v })} />
          <NumberField
            label="Толщина обводки"
            value={el.strokeWidth}
            min={0}
            onChange={(v) => onChange({ strokeWidth: v })}
          />
        </div>
      )}

      <div className="border-t border-hairline pt-3">
        <Label>Порядок слоёв</Label>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <Button type="button" variant="quiet" size="sm" onClick={() => onOrder("front")}>
            На передний план
          </Button>
          <Button type="button" variant="quiet" size="sm" onClick={() => onOrder("back")}>
            На задний план
          </Button>
          <Button type="button" variant="quiet" size="sm" onClick={() => onOrder("up")}>
            Выше
          </Button>
          <Button type="button" variant="quiet" size="sm" onClick={() => onOrder("down")}>
            Ниже
          </Button>
        </div>
      </div>
    </div>
  );
}

function typeLabel(el: Element): string {
  return el.type === "text" ? "Текст" : el.type === "image" ? "Картинка" : el.type === "rect" ? "Прямоугольник" : "Эллипс";
}

// Поля-картинки идут в src, остальные — в текст: под текстовый элемент показываем одни, под картинку другие.
const IMAGE_FIELDS: BindingField[] = ["logo", "wordmark", "photo", "stageLabel", "winnerBadge"];

const BINDING_LABELS: Record<string, string> = {
  "teamA:name": "Команда слева — название",
  "teamB:name": "Команда справа — название",
  "teamA:logo": "Команда слева — лого",
  "teamB:logo": "Команда справа — лого",
  "teamA:wordmark": "Команда слева — вордмарк",
  "teamB:wordmark": "Команда справа — вордмарк",
  "playerA:nickname": "Игрок слева — ник",
  "playerB:nickname": "Игрок справа — ник",
  "playerA:teamName": "Игрок слева — команда",
  "playerB:teamName": "Игрок справа — команда",
  "playerA:photo": "Игрок слева — фото",
  "playerB:photo": "Игрок справа — фото",
  "series:scoreA": "Серия — счёт слева",
  "series:scoreB": "Серия — счёт справа",
  "series:time": "Серия — время",
  "series:format": "Серия — формат",
  "series:stageLabel": "Серия — ярлык стадии",
  "series:winnerBadge": "Серия — бейдж победителя",
};

/** Варианты привязки под тип элемента: картинке — поля-картинки, тексту — текстовые. */
function bindingOptions(type: "text" | "image"): { value: string; label: string }[] {
  const wantImage = type === "image";
  const opts = Object.keys(BINDING_LABELS)
    .filter((k) => IMAGE_FIELDS.includes(k.split(":")[1] as BindingField) === wantImage)
    .map((value) => ({ value, label: BINDING_LABELS[value] }));
  return [{ value: "", label: "— нет привязки —" }, ...opts];
}

function parseBinding(v: string): Binding | undefined {
  if (!v) return undefined;
  const [source, field] = v.split(":");
  return { source: source as Binding["source"], field: field as BindingField };
}
