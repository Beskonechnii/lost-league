"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlayerReport } from "@/app/_components/postgame/types";

/* Опознание команд лиги в чужом матче — та часть отчёта, где нет ни одной строчки вёрстки.
 * Вынесена из `report.tsx` на Э6: там она занимала треть файла и мешала читать сам экран.
 * Правила распознавания не менялись — переехали дословно вместе с комментариями. */

/** Команда из ростера — для подстановки наших лого/тегов по названию или составу матча. */
export type RosterTeam = {
  name: string;
  tag: string | null;
  logo: string | null;
  /** Дивизион («Division 1»/«Division 2»): одноимённые команды из разных дивизионов — разные записи. */
  group: string | null;
  /** Состав команды: steam32 → ник из ростера. См. `lineupOf` в src/lib/roster-data.ts. */
  lineup: { accountId: string; nickname: string }[];
};

export type MatchSource = "opendota" | "steam";

/** Команды лиги — для подстановки наших лого и тегов (наши ассеты приоритетнее OpenDota). */
export function useRosterTeams(): RosterTeam[] {
  const [roster, setRoster] = useState<RosterTeam[]>([]);
  useEffect(() => {
    fetch("/api/roster/teams")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: RosterTeam[]) => setRoster(Array.isArray(list) ? list : []))
      .catch(() => {});
  }, []);
  return roster;
}

export type Detected = { radiant: RosterTeam | null; dire: RosterTeam | null };

/**
 * Опознание сторон по составам плюс словарь ников — всё, что нужно отчёту от ростера.
 *
 * account_id → команды лиги держим СПИСКОМ, а не одной: один человек может стоять в двух
 * составах (играющий за две команды, дубль-ростер). Схлопни его в одну — и распознавание
 * стороны качнётся к случайной из них. Неоднозначность разрешается ниже, при выборе сторон.
 */
export function useDetectedTeams(roster: RosterTeam[], players: PlayerReport[] | undefined) {
  const teamsByAccount = useMemo(() => {
    const m = new Map<string, RosterTeam[]>();
    for (const t of roster) for (const x of t.lineup) m.set(x.accountId, [...(m.get(x.accountId) ?? []), t]);
    return m;
  }, [roster]);

  // account_id → ник из ростера. В клиенте Доты человек может называться как угодно и менять имя
  // между матчами; в лиге у него одно имя, и во всех наших разделах должно стоять именно оно.
  // Неузнанный игрок (стендин, чужой матч) остаётся под своим именем из OpenDota.
  const nickByAccount = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of roster) for (const x of t.lineup) m.set(x.accountId, x.nickname);
    return m;
  }, [roster]);

  // Команды обеих сторон распознаём СОВМЕСТНО, а не каждую по отдельности argmax'ом — иначе
  // дубль-ростерный игрок тянет сторону к своей второй команде (классика: игрок 300$, стоящий
  // ещё и в U.S.Burgers, переголосовывал 300$ в «Бургеров»). Два ключа устойчивости:
  //   • solid — сколько на стороне игроков, состоящих ТОЛЬКО в этой команде; они и есть истина,
  //     дубль-ростерные лишь поддерживают. Ранжируем по (solid, затем всего), порог — двое своих;
  //   • назначаем жадно от самой уверенной стороны и запрещаем одну команду обеим сторонам —
  //     стендин из чужой команды (один голос) команду перебить не может.
  const detected = useMemo((): Detected => {
    const rank = (list: PlayerReport[]) => {
      const score = new Map<RosterTeam, number>();
      const solid = new Map<RosterTeam, number>();
      for (const p of list) {
        const ts = p.accountId != null ? teamsByAccount.get(String(p.accountId)) : undefined;
        if (!ts?.length) continue;
        for (const t of ts) score.set(t, (score.get(t) ?? 0) + 1);
        if (ts.length === 1) solid.set(ts[0], (solid.get(ts[0]) ?? 0) + 1);
      }
      return [...score.entries()]
        .map(([t, n]) => ({ t, n, solid: solid.get(t) ?? 0 }))
        .filter((x) => x.n >= 2)
        .sort((a, b) => b.solid - a.solid || b.n - a.n);
    };
    const rRank = rank(players?.filter((p) => p.side === "radiant") ?? []);
    const dRank = rank(players?.filter((p) => p.side === "dire") ?? []);
    const rTop = rRank[0], dTop = dRank[0];
    // Вторую сторону выбираем после первой: исключаем занятую команду, а среди равных по (solid, n)
    // предпочитаем ТОТ ЖЕ ДИВИЗИОН, что у соперника. Так ReMix D1 и ReMix D2 не путаются: если по
    // составу вышла ничья двух одноимённых команд, дивизион уже определён другой стороной матча.
    const pickOther = (ranked: typeof rRank, taken: RosterTeam | null): RosterTeam | null => {
      const avail = ranked.filter((x) => x.t !== taken);
      if (!avail.length) return null;
      const best = avail[0];
      const tied = avail.filter((x) => x.solid === best.solid && x.n === best.n);
      return ((taken && tied.find((x) => x.t.group === taken.group)) ?? best).t;
    };
    // Первой фиксируем более уверенную сторону (по solid, затем по числу своих).
    const radiantFirst = !dTop || (!!rTop && (rTop.solid > dTop.solid || (rTop.solid === dTop.solid && rTop.n >= dTop.n)));
    if (radiantFirst) {
      const radiant = rTop?.t ?? null;
      return { radiant, dire: pickOther(dRank, radiant) };
    }
    const dire = dTop?.t ?? null;
    return { dire, radiant: pickOther(rRank, dire) };
  }, [teamsByAccount, players]);

  /** Отчёт с подменёнными на ростерные никами — дальше всё рисуется по нему. */
  const withRosterNames = (list: PlayerReport[]) =>
    list.map((p) => {
      const nick = p.accountId != null ? nickByAccount.get(String(p.accountId)) : undefined;
      return nick && nick !== p.name ? { ...p, name: nick } : p;
    });

  return { detected, withRosterNames };
}

/** Команда лиги по введённому названию (или тегу) — без учёта регистра. */
export function teamByName(roster: RosterTeam[], name: string): RosterTeam | null {
  const q = name.trim().toLowerCase();
  if (!q) return null;
  return roster.find((t) => t.name.toLowerCase() === q || (t.tag ?? "").toLowerCase() === q) ?? null;
}
