// Только сервер: разрушительные операции над командой (двухэтапное удаление, см. Team.archivedAt в
// схеме и таб «Ростер»). Одно место правды для двух вызывающих — серверных действий формы пула
// (roster/_components/actions.ts) и API-роута (/api/roster/teams/[id]). Права здесь НЕ проверяются:
// это делает вызывающий (requirePermission / guard) — модулю нельзя тянуть куки, чтобы его могли
// звать и разовые скрипты.
import "server-only";
import { prisma } from "./prisma";

/** Ошибка операции пула с понятным текстом — вызывающий показывает её как есть. */
export class TeamAdminError extends Error {}

/** Первое удаление: команда уходит из пула в архив. Идемпотентно — повторный архив дату не двигает. */
export async function archiveTeam(teamId: number): Promise<void> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { archivedAt: true } });
  if (!team) throw new TeamAdminError("Команда не найдена");
  if (!team.archivedAt) await prisma.team.update({ where: { id: teamId }, data: { archivedAt: new Date() } });
}

/** Возврат из архива в пул — обратная сторона первого удаления. */
export async function restoreTeam(teamId: number): Promise<void> {
  const { count } = await prisma.team.updateMany({ where: { id: teamId }, data: { archivedAt: null } });
  if (!count) throw new TeamAdminError("Команда не найдена");
}

/**
 * Второе удаление: физический снос со всей историей. Разрешён только из архива — один клик не сносит
 * боевую команду со статистикой. Матчи на команду ссылаются без каскада (иначе случайное удаление
 * рвало бы историю), поэтому в транзакции сносим их явно (стата и варды каскадятся от матча),
 * денормализованный `Ward.teamId` обнуляем, остальное (составы, участие, серии, места в группе)
 * уходит каскадом при удалении команды. Всё атомарно — либо команда исчезает целиком, либо никак.
 */
export async function purgeTeam(teamId: number): Promise<void> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { archivedAt: true } });
  if (!team) throw new TeamAdminError("Команда не найдена");
  if (!team.archivedAt) throw new TeamAdminError("Сначала уберите команду в архив, потом удаляйте полностью");
  await prisma.$transaction([
    prisma.match.deleteMany({ where: { OR: [{ teamAId: teamId }, { teamBId: teamId }] } }),
    prisma.ward.updateMany({ where: { teamId }, data: { teamId: null } }),
    prisma.team.delete({ where: { id: teamId } }),
  ]);
}
