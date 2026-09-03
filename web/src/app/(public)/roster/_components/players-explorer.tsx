"use client";

import { useMemo, useState } from "react";
import type { PoolPlayer } from "@/lib/roster-data";
import { teamAccent } from "@/lib/profiles";
import { roleLabel } from "@/lib/roles";
import { EmptyState } from "@/components/pouf/feedback";
import { FilterBar } from "./filter-bar";
import { PlayerMiniCard } from "./player-card";

// Клиентская витрина пула игроков: фильтр по турниру и поиск — в памяти по загруженному списку
// (игроков сотни, но не десятки тысяч; фильтр мгновенный). Пара к PoolExplorer для команд.
// `flagged` — операторская подсветка «нет account_id»; посетителю её не передаём.

export function PlayersExplorer({ players, canFlag }: { players: PoolPlayer[]; canFlag: boolean }) {
  const [q, setQ] = useState("");
  const [tournament, setTournament] = useState("");

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

  return (
    <div className="space-y-4">
      <FilterBar
        query={q}
        onQuery={setQ}
        placeholder="Поиск игрока…"
        label="Поиск игрока"
        options={options}
        tournament={tournament}
        onTournament={setTournament}
        count={`${filtered.length} игроков`}
      />

      {filtered.length === 0 ? (
        players.length === 0 ? (
          <EmptyState icon="user" title="В пуле пока нет игроков">
            Игрок появляется здесь, когда его заводит оператор или одобряет анкету новичка.
          </EmptyState>
        ) : (
          <EmptyState title="Ничего не найдено">Измените запрос или снимите фильтр по турниру.</EmptyState>
        )
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
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
      )}
    </div>
  );
}
