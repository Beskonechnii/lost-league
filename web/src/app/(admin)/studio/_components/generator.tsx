"use client";

import { useState } from "react";
import { IMAGE_MODELS, IMAGE_QUALITIES, IMAGE_SIZES, MAX_IMAGES, MAX_REFERENCES } from "@/lib/image-options";
import { SelectField, TextAreaField } from "../../../_components/form";
import { Button } from "@/components/pouf/Button";
import { Checkbox } from "@/components/pouf/checkbox";

// Генерация картинок по API. Настройки → POST /api/studio/generate → готовые файлы в public/uploads/generated.
// Ключ OpenAI живёт только на сервере, сюда не приходит.

const opts = (list: readonly { value: string; label: string }[]) => list.map((o) => ({ ...o }));

export function Generator() {
  const [model, setModel] = useState<string>(IMAGE_MODELS[0].value);
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<string>(IMAGE_SIZES[0].value);
  const [quality, setQuality] = useState<string>(IMAGE_QUALITIES[0].value);
  const [n, setN] = useState(1);
  const [useRefs, setUseRefs] = useState(false);
  const [refs, setRefs] = useState<File[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<string[]>([]);

  const activeRefs = useRefs ? refs : [];
  const canRun = prompt.trim().length > 0 && !busy && (!useRefs || refs.length > 0);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("model", model);
      body.set("prompt", prompt.trim());
      body.set("size", size);
      body.set("quality", quality);
      body.set("n", String(n));
      for (const f of activeRefs) body.append("ref", f);

      const res = await fetch("/api/studio/generate", { method: "POST", body });
      const json = (await res.json()) as { paths?: string[]; error?: string };
      if (!res.ok || !json.paths) throw new Error(json.error ?? "Не удалось сгенерировать");
      // новые результаты сверху, прошлые не теряем — удобно сравнивать варианты
      setResults((prev) => [...json.paths!, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid items-start gap-8 font-pouf lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
      <div className="space-y-5">
        <SelectField label="Модель" value={model} onChange={setModel} options={opts(IMAGE_MODELS)} />

        <TextAreaField
          label="Промт"
          value={prompt}
          onChange={setPrompt}
          rows={6}
          placeholder="Что нарисовать. Промты для визуала пишем по-английски."
        />

        <SelectField label="Размер" value={size} onChange={setSize} options={opts(IMAGE_SIZES)} />
        <SelectField label="Качество" value={quality} onChange={setQuality} options={opts(IMAGE_QUALITIES)} />

        <SelectField
          label="Количество картинок"
          value={String(n)}
          onChange={(v) => setN(Number(v))}
          options={Array.from({ length: MAX_IMAGES }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
        />

        <div className="rounded-card bg-surface p-4 cushion-field">
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox checked={useRefs} onCheckedChange={(v) => setUseRefs(v === true)} />
            <span className="text-sm font-bold text-ink">Использовать как референс</span>
          </label>
          <p className="mt-1 text-xs font-bold text-muted">
            С референсом модель правит присланные картинки, а не рисует с нуля. До {MAX_REFERENCES} файлов.
          </p>

          {useRefs && (
            <div className="mt-3">
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                className="block w-full text-xs font-bold text-ink-muted file:mr-3 file:rounded-[12px] file:border-0 file:bg-accent-fill file:px-3 file:py-1.5 file:font-black file:text-[var(--on-accent)]"
                onChange={(e) => setRefs(Array.from(e.target.files ?? []).slice(0, MAX_REFERENCES))}
              />
              {refs.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs font-bold text-muted">
                  {refs.map((f) => (
                    <li key={f.name} className="truncate">
                      {f.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button type="button" disabled={!canRun} loading={busy} onClick={() => void run()}>
            {busy ? "Рисую…" : `Сгенерировать${n > 1 ? ` ×${n}` : ""}`}
          </Button>
          {busy && <span className="text-sm font-bold text-muted">высокое качество считается до минуты</span>}
        </div>

        {error && (
          <p className="rounded-control bg-warn px-3 py-2 text-sm font-bold text-[var(--on-accent)]">{error}</p>
        )}
      </div>

      <div>
        {results.length === 0 ? (
          <div className="grid h-[45vh] place-items-center rounded-card bg-surface text-sm font-bold text-muted cushion-field lg:h-[calc(100vh-14rem)]">
            Здесь появятся картинки
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {results.map((src) => (
              <figure key={src} className="overflow-hidden rounded-control bg-canvas cushion-field">
                {/* локальный файл из public/uploads — оптимизация next/image здесь не нужна */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="block w-full" />
                <figcaption className="flex items-center justify-between px-3 py-2 text-xs font-bold">
                  <a href={src} download className="text-[var(--accent-ink)] hover:underline">
                    скачать
                  </a>
                  <a href={src} target="_blank" rel="noreferrer" className="text-muted hover:text-ink-muted">
                    открыть
                  </a>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
        {results.length > 0 && (
          <p className="mt-2 text-xs font-bold text-muted">
            Файлы лежат в <code>public/uploads/generated/</code> — они вне git, чистить вручную.
          </p>
        )}
      </div>
    </div>
  );
}
