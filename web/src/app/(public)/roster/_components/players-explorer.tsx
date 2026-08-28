"use client";

import { useMemo, useState } from "react";
import type { PoolPlayer } from "@/lib/roster-data";
import { teamAccent } from "@/lib/profiles";
import { roleLabel } from "@/lib/roles";
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

  const field =
    "rounded-[14px] bg-surface px-3.5 py-2 text-sm font-semibold text-ink cushion-field outline-none placeholder:text-ink-subtle focus-visible:ring-[3px] focus-visible:ring-purple";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск игрока…"
          className={`${field} min-w-[12rem] flex-1`}
          aria-label="Поиск игрока"
        />
        <select
          value={tournament}
          onChange={(e) => setTournament(e.target.value)}
          className={`${field} shrink-0`}
          aria-label="Фильтр по турниру"
        >
          <option value="">Все турниры</option>
          {options.map((o) => (
            <option key={o.slug} value={o.slug}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="shrink-0 text-sm font-bold text-muted tabular-nums">{filtered.length} игроков</span>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-card bg-surface px-4 py-10 text-center text-sm text-ink-subtle cushion-card">
          {players.length === 0 ? "В пуле пока нет игроков." : "Ничего не найдено — измените запрос или фильтр."}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <PlayerMiniCard
              key={p.id}
              id={p.id}
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
