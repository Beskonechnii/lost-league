"use client";

import type { ReactNode } from "react";
import type { PoolTournament } from "@/lib/roster-data";

// Разрез «По турнирам» для обеих витрин пула: секция на турнир, внутри — карточки тех, кто в нём
// играл. Команда или игрок, прошедшие три сезона, попадут в три секции — это и есть смысл разреза
// («кто был в S4»); увидеть их одной строкой с лентой турниров — это второй разрез, «Сквозной».
//
// Компонент общий и обобщённый: карточки у команд и у игроков разные, а раскладка секций и правило
// «пустую секцию не рисуем» — одни. Порядок секций приходит с сервера (`poolTournaments`), а не
// собирается из самих карточек: иначе он зависел бы от того, кто попал в выборку первым.

export function TournamentGroups<T>({
  items,
  tournaments,
  tournamentsOf,
  render,
  emptyLabel,
}: {
  items: T[];
  /** Порядок секций — свежие турниры сверху. */
  tournaments: PoolTournament[];
  tournamentsOf: (item: T) => PoolTournament[];
  render: (items: T[]) => ReactNode;
  /** Подпись последней секции для тех, кто не играл нигде («Вне турниров»). */
  emptyLabel: string;
}) {
  const groups = tournaments
    .map((tr) => ({
      key: tr.slug,
      title: tr.name,
      items: items.filter((item) => tournamentsOf(item).some((x) => x.slug === tr.slug)),
    }))
    .filter((g) => g.items.length > 0);

  const orphans = items.filter((item) => tournamentsOf(item).length === 0);
  if (orphans.length) groups.push({ key: "__none", title: emptyLabel, items: orphans });

  return (
    <div className="space-y-7">
      {groups.map((g) => (
        <section key={g.key} className="space-y-3">
          <h2 className="flex items-baseline gap-2 font-pouf">
            <span className="text-[15px] font-black tracking-[-0.2px] text-ink">{g.title}</span>
            <span className="text-xs font-bold tabular-nums text-muted">{g.items.length}</span>
          </h2>
          {render(g.items)}
        </section>
      ))}
    </div>
  );
}
