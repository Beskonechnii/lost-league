"use client";

import { useMemo, useState } from "react";
import type { PoolTeam, PoolTournament } from "@/lib/roster-data";
import { EmptyState } from "@/components/pouf/feedback";
import { FilterBar } from "./filter-bar";
import { TeamCards } from "./team-cards";
import { TournamentGroups } from "./tournament-groups";

// Клиентская витрина пула: фильтр по турниру и поиск считаются в памяти по уже загруженному списку —
// команд лиги десятки, отдельные запросы на каждый ввод ни к чему, зато фильтр мгновенный.
// Разрез «в пуле / архив» — серверный (?view в адресе): это разные выборки, их страница и грузит.

export function PoolExplorer({
  teams,
  manage,
  grouped = false,
  tournaments = [],
}: {
  teams: PoolTeam[];
  manage?: { archived: boolean };
  /** Разрез «по турнирам»: секция на турнир вместо одного списка (см. GroupSwitch). */
  grouped?: boolean;
  /** Порядок секций — только для разреза по турнирам. */
  tournaments?: PoolTournament[];
}) {
  const [q, setQ] = useState("");
  const [tournament, setTournament] = useState(""); // slug турнира или "" — все
  // Убранные оптимистично (архив/возврат/снос): revalidatePath на сервере счётчики обновляет, но новые
  // пропсы до этого клиентского списка не доходили, поэтому карточку прячем здесь сразу после успеха.
  const [removed, setRemoved] = useState<Set<number>>(new Set());

  // Опции фильтра — объединение турниров всех команд текущего разреза, свежие сверху уже с сервера.
  const options = useMemo(() => {
    const by = new Map<string, string>();
    for (const t of teams) for (const tr of t.tournaments) if (!by.has(tr.slug)) by.set(tr.slug, tr.short || tr.name);
    return [...by.entries()].map(([slug, label]) => ({ slug, label }));
  }, [teams]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return teams.filter((t) => {
      if (removed.has(t.id)) return false;
      if (tournament && !t.tournaments.some((tr) => tr.slug === tournament)) return false;
      if (!needle) return true;
      const hay = `${t.name} ${t.tag ?? ""} ${t.slug}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [teams, q, tournament, removed]);

  const onManaged = (id: number) => setRemoved((prev) => new Set(prev).add(id));

  return (
    <div className="space-y-4">
      {/* В разрезе по турнирам селект турнира лишний: секции и есть этот фильтр. */}
      <FilterBar
        query={q}
        onQuery={setQ}
        placeholder="Поиск команды…"
        label="Поиск команды"
        options={options}
        tournament={tournament}
        onTournament={setTournament}
        count={`${filtered.length} команд`}
        hideTournament={grouped}
      />

      {filtered.length === 0 ? (
        teams.length === 0 ? (
          <EmptyState
            icon="users"
            title={manage?.archived ? "Архив пуст" : "В пуле пока нет команд"}
          >
            Команда попадает в пул, когда её заводит оператор или принимает заявку капитана.
          </EmptyState>
        ) : (
          <EmptyState title="Ничего не найдено">Измените запрос или снимите фильтр по турниру.</EmptyState>
        )
      ) : grouped ? (
        <TournamentGroups
          items={filtered}
          tournaments={tournaments}
          tournamentsOf={(t) => t.tournaments}
          emptyLabel="Вне турниров"
          render={(rows) => <TeamCards teams={rows} manage={manage} onManaged={onManaged} />}
        />
      ) : (
        <TeamCards teams={filtered} manage={manage} onManaged={onManaged} />
      )}
    </div>
  );
}
