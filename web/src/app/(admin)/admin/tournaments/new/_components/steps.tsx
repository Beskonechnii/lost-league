import Link from "next/link";

// Полоса шагов мастера. Пройденные шаги кликабельны (вернуться и поправить), будущие — нет:
// пока черновика нет, цеплять к нему дивизионы и составы не к чему.

export const WIZARD_STEPS = [
  { key: "describe", label: "Описание" },
  { key: "divisions", label: "Дивизионы" },
  { key: "import", label: "Импорт составов" },
  { key: "draw", label: "Жеребьёвка" },
  { key: "done", label: "Готово" },
] as const;

export type StepKey = (typeof WIZARD_STEPS)[number]["key"];
export const isStep = (v: unknown): v is StepKey => WIZARD_STEPS.some((s) => s.key === v);
export const stepIndex = (key: StepKey) => WIZARD_STEPS.findIndex((s) => s.key === key);

export function Steps({ current, slug }: { current: StepKey; slug: string | null }) {
  const now = stepIndex(current);

  return (
    <ol className="flex flex-wrap items-center gap-2">
      {WIZARD_STEPS.map((s, i) => {
        const done = i < now;
        const cls =
          i === now
            ? "bg-accent-fill text-[var(--on-accent)]"
            : done
              ? "bg-surface-2 text-ink hover:text-accent-bright"
              : "bg-surface-2 text-ink-subtle";
        const body = (
          <span className={`flex items-center gap-2 rounded-[12px] px-3 py-1.5 text-xs font-black ${cls}`}>
            <span className="tabular-nums">{i + 1}</span>
            {s.label}
          </span>
        );

        return (
          <li key={s.key} className="flex items-center gap-2">
            {done && slug ? <Link href={`/admin/tournaments/new/${s.key}?t=${slug}`}>{body}</Link> : body}
            {i < WIZARD_STEPS.length - 1 && <span className="text-ink-subtle">→</span>}
          </li>
        );
      })}
    </ol>
  );
}
