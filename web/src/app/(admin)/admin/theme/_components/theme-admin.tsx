"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button as PoufButton } from "@/components/pouf/Button";
import { Badge } from "@/components/pouf/media";
import { Heading, Eyebrow, Text } from "@/components/pouf/text";
import {
  DEFAULT_THEME,
  FIELDS,
  GROUPS,
  themeToStyle,
  type Theme,
  type ThemeKey,
} from "@/lib/theme";

// Значение поля не всегда hex (у линии — rgba), а <input type=color> умеет только #rrggbb. Поэтому
// источник правды — текстовое поле; color-пикер лишь удобная накладка, из него достаём/кладём hex.
const HEX = /^#[0-9a-fA-F]{6}$/;
const asHex = (v: string) => (HEX.test(v.trim()) ? v.trim() : "#000000");

/** Одна строка редактора: пикер + текст + правдивый образец (показывает и rgba). */
function ColorRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-3 py-2">
      <span
        className="size-9 shrink-0 rounded-lg border border-hairline-strong"
        style={{ background: value }}
        aria-hidden
      />
      <input
        type="color"
        value={asHex(value)}
        onChange={(e) => onChange(e.target.value)}
        className="size-9 shrink-0 cursor-pointer rounded-lg border border-hairline bg-transparent"
        aria-label={`${label} — пипетка`}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="block text-xs text-ink-subtle">{hint}</span>}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="w-44 shrink-0 rounded-lg border border-hairline-strong bg-surface-2 px-3 py-1.5 font-mono text-sm text-ink outline-none focus:border-accent"
      />
    </label>
  );
}

/** Демонстрационная панель: те же утилиты, что на реальном сайте, под цветами черновика.
    Сырые токены --lost-* стоят инлайном на обёртке — @theme inline в globals.css читает их
    в рантайме, поэтому весь блок ниже перекрашивается без сохранения. */
function Preview({ theme }: { theme: Theme }) {
  return (
    <div
      style={themeToStyle(theme)}
      className="overflow-hidden rounded-xl border border-hairline-strong"
    >
      <div className="space-y-4 bg-canvas p-5">
        <div className="space-y-1">
          <div className="text-lg font-bold text-ink">Основной текст — заголовок</div>
          <div className="text-sm text-ink-muted">Приглушённый текст под ним, для подписей.</div>
          <div className="text-xs text-ink-subtle">Тусклый текст — совсем второстепенное.</div>
        </div>

        <div className="rounded-xl border border-hairline bg-surface-1 p-4">
          <div className="text-sm font-semibold text-ink">Поверхность 1 — карточка</div>
          <div className="mt-3 rounded-lg bg-surface-2 p-3 text-sm text-ink-muted">
            Поверхность 2 — панель внутри карточки
          </div>
          <div className="my-3 h-px bg-hairline" />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast"
            >
              Кнопка (бренд / D1)
            </button>
            {/* D2 перекрашивает акцент через собственные токены — показываем рядом */}
            <button
              type="button"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast"
              style={
                {
                  "--accent": "var(--lost-d2)",
                  "--accent-contrast": "var(--lost-d2-contrast)",
                } as React.CSSProperties
              }
            >
              Кнопка (D2)
            </button>
            <a href="#" onClick={(e) => e.preventDefault()} className="text-sm font-medium text-accent-bright hover:underline">
              Ссылка-акцент
            </a>
          </div>
        </div>

        {/* Подушка Кита: карточка, бейджи-тоны, кнопка. Тени и радиусы приезжают из pouf.css
            и панелью не правятся — она управляет только цветом. */}
        <div className="rounded-card bg-surface p-4 font-pouf cushion-card">
          <div className="text-sm font-black">Поверхность pouf — карточка студии</div>
          <div className="mt-1 text-sm font-bold text-muted">Приглушённый текст pouf под ней.</div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="warn">в разработке</Badge>
            <Badge tone="down">ошибка</Badge>
            <Badge tone="up">победа</Badge>
            <Badge tone="info">инфо</Badge>
            <Badge tone="orange">внимание</Badge>
          </div>
          <div className="mt-3">
            <PoufButton size="sm">Кнопка pouf</PoufButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ThemeAdmin({ initial }: { initial: Theme }) {
  const router = useRouter();
  const [saved, setSaved] = useState<Theme>(initial); // последнее записанное на сервере
  const [draft, setDraft] = useState<Theme>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  const set = (key: ThemeKey, v: string) => setDraft((d) => ({ ...d, [key]: v }));

  const dirty = useMemo(() => FIELDS.some((f) => draft[f.key] !== saved[f.key]), [draft, saved]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/theme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = (await res.json().catch(() => ({}))) as Partial<Theme> & { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Не вышло сохранить");
        return;
      }
      const next = json as Theme;
      setSaved(next);
      setDraft(next); // сервер мог поправить грязные значения — показываем, что легло на диск
      setFlash(true);
      setTimeout(() => setFlash(false), 1500);
      router.refresh(); // перечитать корневой layout, чтобы весь сайт встал в новую тему
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Служебная часть · оформление</Eyebrow>
          <Heading level={1}>Тема</Heading>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {flash && (
            <Text size="sm" muted>
              ✓ сохранено
            </Text>
          )}
          <PoufButton variant="quiet" onClick={() => setDraft(DEFAULT_THEME)} disabled={busy}>
            Сбросить к дефолту
          </PoufButton>
          <PoufButton variant="quiet" onClick={() => setDraft(saved)} disabled={busy || !dirty}>
            Отменить правки
          </PoufButton>
          <PoufButton onClick={save} loading={busy} disabled={!dirty}>
            Сохранить
          </PoufButton>
        </div>
      </div>

      <Text size="sm" muted>
        Цвета применяются ко всему сайту сразу после «Сохранить». Значения хранятся в data/theme.json
        (коммитится и едет между устройствами). Дивизион D2 перекрашивает акцент в свой цвет.
      </Text>

      {error && <div className="text-sm font-bold text-[var(--down)]">{error}</div>}

      {/* Слева — редактор по группам, справа — живое превью черновика (обновляется без сохранения). */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          {GROUPS.map((group) => (
            <section key={group} className="rounded-xl border border-hairline bg-surface-1 p-4">
              <div className="eyebrow mb-1 text-ink-subtle">{group}</div>
              <div className="divide-y divide-hairline">
                {FIELDS.filter((f) => f.group === group).map((f) => (
                  <ColorRow
                    key={f.key}
                    label={f.label}
                    hint={f.hint}
                    value={draft[f.key]}
                    onChange={(v) => set(f.key, v)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="eyebrow mb-2 text-ink-subtle">Превью</div>
          <Preview theme={draft} />
        </div>
      </div>
    </div>
  );
}
