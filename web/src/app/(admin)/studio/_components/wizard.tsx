"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { domToPng } from "modern-screenshot";
import { Canvas } from "@/studio/Canvas";
import { getTemplate } from "@/studio/registry";
import { resolvePayload, type Refs } from "@/studio/resolve";
import {
  emptyPayload,
  emptyRow,
  type FieldDef,
  type MatchOption,
  type RawPayload,
  type RawRow,
  type ScoreBoard,
  type TemplateDef,
} from "@/studio/types";
import { Label, SelectField, TextField } from "../../../_components/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/pouf/select";
import { Button } from "@/components/pouf/Button";

// Мастер генерации: форма строится из schema шаблона, справа — живое превью,
// снизу — экспорт PNG в натуральном размере и сохранение payload в историю.

export function Wizard(props: { templateId: string; refs: Refs; matches: MatchOption[]; initial?: RawPayload }) {
  const template = getTemplate(props.templateId);
  if (!template) return <p className="text-rose-700">Шаблон «{props.templateId}» не найден.</p>;
  return <WizardForm {...props} template={template} />;
}

function WizardForm({
  template,
  refs,
  matches,
  initial,
}: {
  template: TemplateDef;
  refs: Refs;
  matches: MatchOption[];
  initial?: RawPayload;
}) {
  const [payload, setPayload] = useState<RawPayload>(() => initial ?? emptyPayload(template.fields));
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Скорборды карт (kind:"match") догружаются по выбору матча — отчёт тяжёлый и серверный.
  const [boards, setBoards] = useState<Record<string, ScoreBoard>>({});
  const [boardError, setBoardError] = useState<string | null>(null);
  const [boardBusy, setBoardBusy] = useState(false);
  const node = useRef<HTMLDivElement>(null);

  // matchId'ы, выбранные в полях kind:"match" (у наших шаблонов такое поле одно).
  const matchIds = useMemo(() => {
    const keys = template.fields.filter((f) => f.kind === "match").map((f) => f.key);
    return keys.map((k) => (typeof payload[k] === "string" ? (payload[k] as string) : "")).filter(Boolean);
  }, [template, payload]);

  // Догрузка недостающих бордов при выборе матча (в т.ч. из initial payload, ?match=).
  useEffect(() => {
    const missing = matchIds.filter((id) => !(id in boards));
    if (missing.length === 0) return;
    let cancelled = false;
    const load = async () => {
      setBoardBusy(true);
      setBoardError(null);
      try {
        const pairs = await Promise.all(
          missing.map(async (id) => {
            const res = await fetch(`/api/studio/match-board?matchId=${id}`);
            if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Не удалось собрать скорборд");
            return [id, (await res.json()) as ScoreBoard] as const;
          }),
        );
        if (!cancelled) setBoards((b) => ({ ...b, ...Object.fromEntries(pairs) }));
      } catch (e) {
        if (!cancelled) setBoardError(e instanceof Error ? e.message : "Ошибка");
      } finally {
        if (!cancelled) setBoardBusy(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [matchIds, boards]);

  const mergedRefs = useMemo<Refs>(() => ({ ...refs, boards }), [refs, boards]);
  const data = useMemo(() => resolvePayload(template.fields, payload, mergedRefs), [template, payload, mergedRefs]);
  const { size, Render } = template;

  const setField = (key: string, value: string) => setPayload((p) => ({ ...p, [key]: value }));
  const setRow = (key: string, i: number, sub: string, value: string) =>
    setPayload((p) => {
      const rows = [...((p[key] as RawRow[]) ?? [])];
      rows[i] = { ...rows[i], [sub]: value };
      return { ...p, [key]: rows };
    });

  /** Автозаполнение из матча в БД: верхнеуровневые поля или новая строка группы. */
  function prefill(m: MatchOption, groupKey?: string) {
    const fill: RawRow = {
      teamA: m.teamAId ? String(m.teamAId) : "",
      teamB: m.teamBId ? String(m.teamBId) : "",
      time: m.time,
      division: m.division,
    };
    setPayload((p) => {
      if (!groupKey) return { ...p, ...fill };
      const group = template.fields.find((f) => f.key === groupKey);
      const blank = group?.kind === "group" ? emptyRow(group.fields) : {};
      const rows = [...((p[groupKey] as RawRow[]) ?? [])];
      const max = group?.kind === "group" ? group.max : 1;
      const next = { ...blank, ...fill };
      const emptyIdx = rows.findIndex((r) => !r.teamA && !r.teamB);
      if (emptyIdx >= 0) rows[emptyIdx] = next;
      else if (rows.length < max) rows.push(next);
      else rows[rows.length - 1] = next;
      return { ...p, [groupKey]: rows };
    });
  }

  async function exportPng() {
    if (!node.current) return;
    setBusy(true);
    try {
      // масштаб превью снимаем на клоне — PNG выходит ровно size.w × size.h
      const url = await domToPng(node.current, {
        width: size.w,
        height: size.h,
        style: { transform: "none" },
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${template.id}-${Date.now()}.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setSaved(null);
    // Привязываем сохранённый рендер к матчу — так он виден в архиве серий по своей карте.
    const matchId = matchIds.length ? Number(matchIds[0]) : undefined;
    const res = await fetch("/api/studio/renders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ templateId: template.id, payload, matchId }),
    });
    setSaved(res.ok ? "Сохранено в историю" : "Не удалось сохранить");
  }

  const groupKey = template.fields.find((f) => f.kind === "group")?.key;

  return (
    <div className="grid items-start gap-8 font-pouf lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
      <div className="space-y-5">
        {matches.length > 0 && (
          <div className="rounded-card bg-surface p-4 cushion-field">
            <Label>Взять из матча</Label>
            {/* Пикер-действие, а не поле: контролируемый value="" держит плейсхолдер после выбора,
                поэтому список сам «сбрасывается» — как раньше делал e.currentTarget.value = "". */}
            <Select
              value=""
              onValueChange={(v) => {
                const m = matches.find((x) => String(x.id) === v);
                if (m) prefill(m, groupKey);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="— выбрать матч —" />
              </SelectTrigger>
              <SelectContent>
                {matches.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {template.fields.map((f) =>
          f.kind === "group" ? (
            <GroupField
              key={f.key}
              field={f}
              rows={(payload[f.key] as RawRow[]) ?? []}
              refs={refs}
              matches={matches}
              onChange={(i, sub, v) => setRow(f.key, i, sub, v)}
              onAdd={() =>
                setPayload((p) => ({ ...p, [f.key]: [...((p[f.key] as RawRow[]) ?? []), emptyRow(f.fields)] }))
              }
              onRemove={(i) =>
                setPayload((p) => ({ ...p, [f.key]: ((p[f.key] as RawRow[]) ?? []).filter((_, j) => j !== i) }))
              }
            />
          ) : (
            <PlainField
              key={f.key}
              field={f}
              value={(payload[f.key] as string) ?? ""}
              refs={refs}
              matches={matches}
              onChange={(v) => setField(f.key, v)}
            />
          ),
        )}

        {boardBusy && <p className="text-sm font-bold text-muted">Собираю скорборд…</p>}
        {boardError && <p className="text-sm font-bold text-rose-700">{boardError}</p>}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button type="button" loading={busy} onClick={() => void exportPng()}>
            {busy ? "Готовлю PNG…" : `Скачать PNG ${size.w}×${size.h}`}
          </Button>
          <Button type="button" variant="quiet" onClick={() => void save()}>
            Сохранить в историю
          </Button>
          {saved && <span className="text-sm font-bold text-ink-muted">{saved}</span>}
        </div>
      </div>

      {/* превью держим в поле зрения: липкая колонка ростом не выше экрана */}
      <div className="lg:sticky lg:top-6">
        <div className="h-[45vh] min-h-[220px] lg:h-[calc(100vh-11rem)]">
          <Canvas w={size.w} h={size.h} nodeRef={node}>
            <Render data={data} />
          </Canvas>
        </div>
        <p className="mt-2 text-center text-xs font-bold text-muted">
          Превью масштабировано; PNG выгружается в натуральных {size.w}×{size.h}.
        </p>
      </div>
    </div>
  );
}

function PlainField({
  field,
  value,
  refs,
  matches,
  onChange,
}: {
  field: FieldDef;
  value: string;
  refs: Refs;
  matches: MatchOption[];
  onChange: (v: string) => void;
}) {
  if (field.kind === "match") {
    return (
      <SelectField
        label={field.label}
        value={value}
        onChange={onChange}
        options={[{ value: "", label: "— матч —" }, ...matches.map((m) => ({ value: String(m.id), label: m.label }))]}
      />
    );
  }
  if (field.kind === "team") {
    return (
      <SelectField
        label={field.label}
        value={value}
        onChange={onChange}
        options={[{ value: "", label: "— команда —" }, ...refs.teams.map((t) => ({ value: String(t.id), label: t.name }))]}
      />
    );
  }
  if (field.kind === "player") {
    return (
      <SelectField
        label={field.label}
        value={value}
        onChange={onChange}
        options={[
          { value: "", label: "— игрок —" },
          ...refs.players.map((p) => ({ value: String(p.id), label: p.teamName ? `${p.nickname} (${p.teamName})` : p.nickname })),
        ]}
      />
    );
  }
  if (field.kind === "select") {
    return (
      <SelectField
        label={field.label}
        value={value}
        onChange={onChange}
        options={field.options.map((o) => ({ value: o, label: o }))}
      />
    );
  }
  if (field.kind === "text") {
    return <TextField label={field.label} value={value} onChange={onChange} placeholder={field.placeholder} />;
  }
  return null;
}

function GroupField({
  field,
  rows,
  refs,
  matches,
  onChange,
  onAdd,
  onRemove,
}: {
  field: Extract<FieldDef, { kind: "group" }>;
  rows: RawRow[];
  refs: Refs;
  matches: MatchOption[];
  onChange: (i: number, sub: string, v: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>{field.label}</Label>
        {rows.length < field.max && (
          <button type="button" onClick={onAdd} className="text-xs font-black text-[var(--accent-ink)] hover:underline">
            + добавить
          </button>
        )}
      </div>
      {rows.map((row, i) => (
        <div key={i} className="space-y-3 rounded-card bg-surface p-4 cushion-field">
          <div className="flex items-center justify-between text-xs font-bold text-muted">
            <span>#{i + 1}</span>
            <button type="button" onClick={() => onRemove(i)} className="hover:text-rose-700">
              убрать
            </button>
          </div>
          {field.fields.map((sub) => (
            <PlainField
              key={sub.key}
              field={sub}
              value={row[sub.key] ?? ""}
              refs={refs}
              matches={matches}
              onChange={(v) => onChange(i, sub.key, v)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
