import Link from "next/link";
import { TOUCH_TARGET } from "@/app/_components/nav-scroll";

// Команды / Игроки — это не раздел, а разрез одной витрины (UI-GUIDELINES §2, L4), поэтому живёт
// в теле страницы рядом с фильтром дивизиона, а не третьим рядом хрома под строкой контекста.
// Раньше здесь был свой SubNav, и на ростере получалось три ряда навигации подряд.

export function RosterSwitch({ slug, current }: { slug: string; current: "teams" | "players" }) {
  const tabs = [
    { key: "teams" as const, label: "Команды" },
    { key: "players" as const, label: "Игроки" },
  ];
  return (
    <div className="flex gap-2 font-pouf">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={`/tournaments/${slug}/roster/${t.key}`}
          aria-current={t.key === current ? "page" : undefined}
          className={`inline-flex items-center rounded-[14px] px-3.5 py-[7px] text-[13px] font-black transition-[box-shadow,transform,background] ${TOUCH_TARGET} ${
            t.key === current
              ? "bg-purple text-[var(--on-accent)] cushion-control"
              : "bg-surface text-ink-muted cushion-field hover:text-ink"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
