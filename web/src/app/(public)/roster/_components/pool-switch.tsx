import { PillLink } from "@/components/pouf/tabs";

// Команды / Игроки в общем пуле — разрез одной витрины (как RosterSwitch внутри турнира, но пул
// сквозной по сезонам, поэтому ведёт на /roster и /roster/players, без слага турнира).
export function PoolSwitch({ current }: { current: "teams" | "players" }) {
  const tabs = [
    { key: "teams" as const, label: "Команды", href: "/roster" },
    { key: "players" as const, label: "Игроки", href: "/roster/players" },
  ];
  return (
    <div className="flex gap-2">
      {tabs.map((t) => (
        <PillLink key={t.key} href={t.href} active={t.key === current}>
          {t.label}
        </PillLink>
      ))}
    </div>
  );
}
