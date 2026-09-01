"use client";

import { Button } from "@/components/pouf/Button";
import { FormInput } from "@/components/pouf/Input";
import { Checkbox } from "@/components/pouf/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/pouf/select";
import { FORMAT_PRESETS } from "./model";

// Верхняя панель редактора: имя, формат холста, фон, экспорт и сохранение.

export function Toolbar({
  title,
  onTitle,
  w,
  h,
  background,
  backgroundImage,
  backgroundFit,
  onFormat,
  onBackground,
  onBackgroundFit,
  onClearBackgroundImage,
  onExport,
  onSave,
  busy,
  saved,
  showGrid,
  gridSize,
  onGrid,
  constrain,
  onConstrain,
}: {
  title: string;
  onTitle: (v: string) => void;
  w: number;
  h: number;
  background: string;
  backgroundImage?: string;
  backgroundFit?: "cover" | "contain";
  onFormat: (w: number, h: number) => void;
  onBackground: (v: string) => void;
  onBackgroundFit: (v: "cover" | "contain") => void;
  onClearBackgroundImage: () => void;
  onExport: () => void;
  onSave: () => void;
  busy: boolean;
  saved: string | null;
  showGrid: boolean;
  gridSize: number;
  onGrid: (show: boolean, size: number) => void;
  constrain: boolean;
  onConstrain: (v: boolean) => void;
}) {
  const current = `${w}×${h}`;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-hairline bg-surface-1/40 p-3">
      <FormInput value={title} onChange={(e) => onTitle(e.target.value)} placeholder="Без названия" className="w-52" />

      <Select
        value={current}
        onValueChange={(v) => {
          const p = FORMAT_PRESETS.find((x) => `${x.w}×${x.h}` === v);
          if (p) onFormat(p.w, p.h);
        }}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Формат" />
        </SelectTrigger>
        <SelectContent>
          {FORMAT_PRESETS.map((p) => (
            <SelectItem key={`${p.w}×${p.h}`} value={`${p.w}×${p.h}`}>
              {p.label}
            </SelectItem>
          ))}
          {/* текущий нестандартный размер держим в списке, чтобы селект не сбрасывался */}
          {!FORMAT_PRESETS.some((p) => `${p.w}×${p.h}` === current) && (
            <SelectItem value={current}>{current} (свой)</SelectItem>
          )}
        </SelectContent>
      </Select>

      <label className="flex items-center gap-2 text-xs text-ink-subtle">
        Фон
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(background) ? background : "#000000"}
          onChange={(e) => onBackground(e.target.value)}
          className="h-8 w-9 cursor-pointer rounded border border-hairline bg-surface-1"
        />
      </label>

      {/* Фон-картинку выбирают из библиотеки слева (режим «В фон»); тут — что выбрано, как вписать и сброс */}
      {backgroundImage && (
        <div className="flex items-center gap-2 text-xs text-ink-subtle" title="Фон-картинка холста">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={backgroundImage} alt="" className="h-8 w-8 rounded border border-hairline object-cover" />
          <div className="flex overflow-hidden rounded border border-hairline">
            {(["cover", "contain"] as const).map((fit) => (
              <button
                key={fit}
                type="button"
                onClick={() => onBackgroundFit(fit)}
                className={`px-2 py-1 transition ${
                  (backgroundFit ?? "cover") === fit ? "bg-accent text-white" : "bg-surface-1 text-ink-muted hover:text-ink"
                }`}
              >
                {fit === "cover" ? "залить" : "вписать"}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClearBackgroundImage} className="text-ink-subtle hover:text-rose-700" title="Убрать фон-картинку">
            ✕
          </button>
        </div>
      )}

      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-subtle">
        <Checkbox checked={showGrid} onCheckedChange={(v) => onGrid(v === true, gridSize)} />
        Сетка
      </label>
      {showGrid && (
        <label className="flex items-center gap-1.5 text-xs text-ink-subtle">
          шаг
          <FormInput
            type="number"
            min={4}
            value={gridSize}
            onChange={(e) => onGrid(true, Math.max(4, Number(e.target.value) || 4))}
            className="h-8 w-20"
          />
        </label>
      )}

      <label
        className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-subtle"
        title="Не давать элементам уходить за край холста"
      >
        <Checkbox checked={constrain} onCheckedChange={(v) => onConstrain(v === true)} />
        В пределах холста
      </label>

      <div className="ml-auto flex items-center gap-3">
        {saved && <span className="text-sm text-ink-muted">{saved}</span>}
        <Button type="button" variant="quiet" onClick={onSave}>
          Сохранить
        </Button>
        <Button type="button" disabled={busy} onClick={onExport}>
          {busy ? "Готовлю PNG…" : `Скачать PNG ${w}×${h}`}
        </Button>
      </div>
    </div>
  );
}
