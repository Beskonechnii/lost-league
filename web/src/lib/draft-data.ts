// Пул игроков для шоу-драфта UNDERBEER 2.0 — снимок живого ростера на момент открытия сессии.
// Только чтение: команды драфта в ростер не пишут. Снимок кладётся в payload (см. draft.ts),
// поэтому прошлый драфт читается даже после ухода игрока из ростера.

import { listPlayers } from "@/lib/roster-data";
import { prisma } from "@/lib/prisma";
import { teamAccent } from "@/lib/profiles";
import { parseRoleKeys } from "@/lib/roles";
import type { PoolPlayer } from "@/lib/draft";

/**
 * Плоский пул: каждый игрок один раз, цвет — по основному месту в ростере (listPlayers уже кладёт
 * его в `main`).
 *
 * Роль берётся из одного места и в одном порядке (ТЗ 41), а не пересчитывается консолью и оверлеем:
 *   1) место в составе дивизиона ЭТОГО турнира — оно назначено оператором и сильнее всего;
 *   2) роли, отмеченные при записи на ЭТОТ турнир (`desiredRoles`, ТЗ 38);
 *   3) основные роли игрока (`mainRoles`) — что человек сам о себе заявил.
 * Место прошлого сезона на роль в драфте индивидуального турнира не влияет: там другой турнир,
 * другая команда и, как правило, другая позиция.
 *
 * Ad hoc-UNDERBEER турнира не имеет: записи нет, дивизиона нет — остаются основные роли, а при
 * их отсутствии свежайшее место ростера (`p.main`), иначе весь импортированный ростер осел бы
 * в «Без позиции».
 */
export async function draftPool(tournamentId?: number): Promise<PoolPlayer[]> {
  const [players, registrations, spots] = await Promise.all([
    listPlayers(),
    tournamentId == null
      ? []
      : prisma.tournamentRegistration.findMany({
          where: { tournamentId },
          select: { playerId: true, desiredRoles: true },
        }),
    tournamentId == null
      ? []
      : prisma.rosterSpot.findMany({
          where: { division: { tournamentId } },
          select: { playerId: true, role: true },
        }),
  ]);
  const desired = new Map(registrations.map((r) => [r.playerId, parseRoleKeys(r.desiredRoles)]));
  const placed = new Map(spots.filter((s) => s.role).map((s) => [s.playerId, [s.role as string]]));

  return players.map((p): PoolPlayer => {
    const team = p.main?.team ?? null;
    const own = parseRoleKeys(p.mainRoles);
    return {
      id: p.id,
      nickname: p.nickname,
      realName: p.realName,
      photo: p.photo,
      mmr: p.mmr,
      roles:
        tournamentId == null
          ? own.length
            ? own
            : p.main?.role
              ? [p.main.role]
              : []
          : placed.get(p.id) ?? desired.get(p.id) ?? own,
      // акцент ростерной команды для аватарки-заглушки; без команды — тон из слага игрока
      teamColor: team ? teamAccent(team) : teamAccent({ slug: p.slug, name: p.nickname }),
    };
  });
}
