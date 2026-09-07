"use client";

import { useMemo, useState } from "react";
import type { PoolTeam, PoolTournament } from "@/lib/roster-data";
import { EmptyState } from "@/components/pouf/feedback";
import { FilterBar } from "./filter-bar";
import { Pager } from "./pager";
import { TeamCards } from "./team-cards";
import { TournamentGroups } from "./tournament-groups";

const PAGE_SIZE = 12;

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
  // Страница — только для плоского списка: в разрезе по турнирам секции уже делят полотно на части,
  // второй разбивкой поверх первой только запутаешь.
  const [page, setPage] = useState(1);

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

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shownPage = Math.min(page, pageCount);
  const paged = filtered.slice((shownPage - 1) * PAGE_SIZE, shownPage * PAGE_SIZE);

  const onQuery = (v: string) => {
    setQ(v);
    setPage(1);
  };
  const onTournament = (v: string) => {
    setTournament(v);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* В разрезе по турнирам селект турнира лишний: секции и есть этот фильтр. */}
      <FilterBar
        query={q}
        onQuery={onQuery}
        placeholder="Поиск команды…"
        label="Поиск команды"
        options={options}
        tournament={tournament}
        onTournament={onTournament}
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
        <>
          <TeamCards teams={paged} manage={manage} onManaged={onManaged} />
          <Pager page={shownPage} pageCount={pageCount} onPage={setPage} />
        </>
      )}
    </div>
  );
}
