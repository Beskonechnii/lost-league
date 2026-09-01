"use client";

import { useMemo, useState } from "react";
import type { PoolTeam } from "@/lib/roster-data";
import { TeamCards } from "./team-cards";

// Клиентская витрина пула: фильтр по турниру и поиск считаются в памяти по уже загруженному списку —
// команд лиги десятки, отдельные запросы на каждый ввод ни к чему, зато фильтр мгновенный.
// Разрез «в пуле / архив» — серверный (?view в адресе): это разные выборки, их страница и грузит.

export function PoolExplorer({ teams, manage }: { teams: PoolTeam[]; manage?: { archived: boolean } }) {
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

  const field =
    "rounded-[14px] bg-surface px-3.5 py-2 text-sm font-semibold text-ink cushion-field outline-none placeholder:text-ink-subtle focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск команды…"
          className={`${field} min-w-[12rem] flex-1`}
          aria-label="Поиск команды"
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
        <span className="shrink-0 text-sm font-bold text-muted tabular-nums">{filtered.length} команд</span>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-card bg-surface px-4 py-10 text-center text-sm text-ink-subtle cushion-card">
          {teams.length === 0
            ? manage?.archived
              ? "Архив пуст."
              : "В пуле пока нет команд."
            : "Ничего не найдено — измените запрос или фильтр."}
        </p>
      ) : (
        <TeamCards teams={filtered} manage={manage} onManaged={onManaged} />
      )}
    </div>
  );
}
