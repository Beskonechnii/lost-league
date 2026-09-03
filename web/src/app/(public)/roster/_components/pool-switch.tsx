import { PillLink } from "@/components/pouf/tabs";

// Команды / Игроки в общем пуле — разрез одной витрины (как RosterSwitch внутри турнира, но пул
// сквозной по сезонам, поэтому ведёт на /roster и /roster/players, без слага турнира).
export function PoolSwitch({ current, group }: { current: "teams" | "players"; group?: string }) {
  // Разрез «по турнирам» переезжает вместе с вкладкой: человек, смотревший команды по сезонам,
  // ждёт по сезонам и игроков — а не сброса к общему списку.
  const q = group === "tournament" ? "?by=tournament" : "";
  const tabs = [
    { key: "teams" as const, label: "Команды", href: `/roster${q}` },
    { key: "players" as const, label: "Игроки", href: `/roster/players${q}` },
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

/**
 * Второй разрез той же витрины: одним списком или по турнирам.
 *
 * «Сквозной» — каждая команда и каждый человек ровно одной карточкой, турниры лентой на ней:
 * так видно того, кто идёт из сезона в сезон. «По турнирам» — секция на турнир: так видно состав
 * сезона. Одно другим не заменяется, поэтому это разрез, а не сортировка (решение 04.09.2026).
 *
 * Живёт в адресе (`?by=tournament`), как и остальные разрезы на сайте: ссылку на нужный вид
 * можно кинуть в чат.
 */
export function GroupSwitch({ base, group, extra = "" }: { base: string; group?: string; extra?: string }) {
  const grouped = group === "tournament";
  const join = (params: string) => {
    const all = [extra, params].filter(Boolean).join("&");
    return all ? `${base}?${all}` : base;
  };
  return (
    <div className="flex gap-2">
      <PillLink href={join("")} active={!grouped} size="md">
        Сквозной
      </PillLink>
      <PillLink href={join("by=tournament")} active={grouped} size="md">
        По турнирам
      </PillLink>
    </div>
  );
}
