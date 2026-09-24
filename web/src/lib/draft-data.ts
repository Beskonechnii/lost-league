// Пул игроков для шоу-драфта UNDERBEER 2.0 — снимок живого ростера на момент открытия сессии.
// Только чтение: команды драфта в ростер не пишут. Снимок кладётся в payload (см. draft.ts),
// поэтому прошлый драфт читается даже после ухода игрока из ростера.

import { listPlayers } from "@/lib/roster-data";
import { prisma } from "@/lib/prisma";
import { teamAccent } from "@/lib/profiles";
import { parseRoleKeys } from "@/lib/roles";
import type { PoolPlayer } from "@/lib/draft";

/**
 * Плоский пул: каждый игрок один раз, позиция и цвет — по основному месту в ростере
 * (listPlayers уже кладёт его в `main`).
 *
 * `tournamentId` — турнир индивидуального формата, из которого собирается драфт: тем, у кого
 * ростерного места нет, роли берутся из их записи на этот турнир (ТЗ 38). Место в составе
 * сильнее желания: у ростерного игрока роль одна и она из `RosterSpot`, как и была.
 * Ad hoc-UNDERBEER турнира не имеет — там `desiredRoles` взять неоткуда и не нужно.
 */
export async function draftPool(tournamentId?: number): Promise<PoolPlayer[]> {
  const [players, registrations] = await Promise.all([
    listPlayers(),
    tournamentId == null
      ? []
      : prisma.tournamentRegistration.findMany({
          where: { tournamentId },
          select: { playerId: true, desiredRoles: true },
        }),
  ]);
  const desired = new Map(registrations.map((r) => [r.playerId, parseRoleKeys(r.desiredRoles)]));

  return players.map((p): PoolPlayer => {
    const spot = p.main;
    const team = spot?.team ?? null;
    return {
      id: p.id,
      nickname: p.nickname,
      realName: p.realName,
      photo: p.photo,
      mmr: p.mmr,
      roles: spot?.role ? [spot.role] : desired.get(p.id) ?? [],
      // акцент ростерной команды для аватарки-заглушки; без команды — тон из слага игрока
      teamColor: team ? teamAccent(team) : teamAccent({ slug: p.slug, name: p.nickname }),
    };
  });
}
