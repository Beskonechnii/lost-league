"use client";

import { Label } from "@/app/_components/form";
import { FormInput } from "@/components/pouf/Input";

// Мелкие контролы инспектора: число и цвет. Текст/селект берём из общего app/_components/form.

export function NumberField(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
}) {
  return (
    <label className="block">
      <Label>{props.label}</Label>
      <FormInput
        type="number"
        value={Number.isFinite(props.value) ? props.value : 0}
        step={props.step ?? 1}
        min={props.min}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function ColorField(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <Label>{props.label}</Label>
      <div className="flex items-center gap-2">
        {/* нативный color-input — компактный и без зависимостей; hex дублируем текстом для rgba/точной правки */}
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(props.value) ? props.value : "#000000"}
          onChange={(e) => props.onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded border border-hairline bg-surface-1"
        />
        <FormInput value={props.value} onChange={(e) => props.onChange(e.target.value)} />
      </div>
    </label>
  );
}
