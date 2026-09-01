import Link from "next/link";
import { TOUCH_TARGET } from "@/app/_components/nav-scroll";

// Команды / Игроки в общем пуле — разрез одной витрины (как RosterSwitch внутри турнира, но пул
// сквозной по сезонам, поэтому ведёт на /roster и /roster/players, без слага турнира).
export function PoolSwitch({ current }: { current: "teams" | "players" }) {
  const tabs = [
    { key: "teams" as const, label: "Команды", href: "/roster" },
    { key: "players" as const, label: "Игроки", href: "/roster/players" },
  ];
  return (
    <div className="flex gap-2 font-pouf">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === current ? "page" : undefined}
          className={`inline-flex items-center rounded-[14px] px-3.5 py-[7px] text-[13px] font-black transition-[box-shadow,transform,background] ${TOUCH_TARGET} ${
            t.key === current
              ? "bg-accent-fill text-[var(--on-accent)] cushion-control"
              : "bg-surface text-ink-muted cushion-field hover:text-ink"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
