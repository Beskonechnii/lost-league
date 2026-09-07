"use client";

import { useMemo, useState } from "react";
import type { PoolPlayer, PoolTournament } from "@/lib/roster-data";
import { teamAccent } from "@/lib/profiles";
import { roleLabel } from "@/lib/roles";
import { EmptyState } from "@/components/pouf/feedback";
import { FilterBar } from "./filter-bar";
import { Pager } from "./pager";
import { PlayerMiniCard } from "./player-card";
import { TournamentGroups } from "./tournament-groups";

const PAGE_SIZE = 24;

// Клиентская витрина пула игроков: фильтр по турниру и поиск — в памяти по загруженному списку
// (игроков сотни, но не десятки тысяч; фильтр мгновенный). Пара к PoolExplorer для команд.
// `flagged` — операторская подсветка «нет account_id»; посетителю её не передаём.

export function PlayersExplorer({
  players,
  canFlag,
  grouped = false,
  tournaments = [],
}: {
  players: PoolPlayer[];
  canFlag: boolean;
  /** Разрез «по турнирам»: секция на турнир вместо одного списка (см. GroupSwitch). */
  grouped?: boolean;
  tournaments?: PoolTournament[];
}) {
  const [q, setQ] = useState("");
  const [tournament, setTournament] = useState("");
  const [page, setPage] = useState(1);

  const options = useMemo(() => {
    const by = new Map<string, string>();
    for (const p of players) for (const tr of p.tournaments) if (!by.has(tr.slug)) by.set(tr.slug, tr.short || tr.name);
    return [...by.entries()].map(([slug, label]) => ({ slug, label }));
  }, [players]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return players.filter((p) => {
      if (tournament && !p.tournaments.some((tr) => tr.slug === tournament)) return false;
      if (!needle) return true;
      const hay = `${p.nickname} ${p.main?.team.name ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [players, q, tournament]);

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
      <FilterBar
        query={q}
        onQuery={onQuery}
        placeholder="Поиск игрока…"
        label="Поиск игрока"
        options={options}
        tournament={tournament}
        onTournament={onTournament}
        count={`${filtered.length} игроков`}
        hideTournament={grouped}
      />

      {filtered.length === 0 ? (
        players.length === 0 ? (
          <EmptyState icon="user" title="В пуле пока нет игроков">
            Игрок появляется здесь, когда его заводит оператор или одобряет анкету новичка.
          </EmptyState>
        ) : (
          <EmptyState title="Ничего не найдено">Измените запрос или снимите фильтр по турниру.</EmptyState>
        )
      ) : grouped ? (
        <TournamentGroups
          items={filtered}
          tournaments={tournaments}
          tournamentsOf={(p) => p.tournaments}
          emptyLabel="Вне турниров"
          render={cards}
        />
      ) : (
        <>
          {cards(paged)}
          <Pager page={shownPage} pageCount={pageCount} onPage={setPage} />
        </>
      )}
    </div>
  );

  function cards(rows: PoolPlayer[]) {
    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => (
            <PlayerMiniCard
              key={p.id}
              id={p.id}
              slug={p.slug}
              nickname={p.nickname}
              photo={p.photo}
              accent={p.main ? teamAccent(p.main.team) : null}
              role={roleLabel(p.main?.role)}
              mmr={p.mmr}
              country={p.country}
              isCaptain={p.main?.isCaptain ?? false}
              size={56}
              flagged={canFlag && !p.accountId}
              subtitle={
                <div className="mt-1 space-y-0.5">
                  <div className="truncate text-xs text-ink-subtle">{p.main?.team.name ?? "без команды"}</div>
                  {p.tournaments.length > 0 && (
                    <div className="truncate text-xs text-ink-subtle">{p.tournaments.map((t) => t.short || t.name).join(" · ")}</div>
                  )}
                  {p.otherTeams.length > 0 && (
                    <div className="truncate text-xs text-ink-subtle">ещё в {p.otherTeams.join(", ")}</div>
                  )}
                </div>
              }
            />
          ))}
        </div>
    );
  }
}
