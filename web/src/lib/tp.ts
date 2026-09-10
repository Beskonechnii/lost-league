// Только сервер: сезонный зачёт TP (очки MVP).
//
// Зачёт **турнирный**: в новом сезоне счёт начинается заново, а история прошлых не теряется.
// Поэтому истина — реестр `PointsEntry` (reason="tp", `tournamentId`), а `Player.tp` остался
// кешем «за всё время»: его читают витрины, которым нужна одна цифра (карточка игрока, студия),
// и пересчитывать сумму в каждой такой выборке ради этого незачем.
//
// Реестр же, в отличие от одного поля, отвечает на вопрос «за что и когда» — ровно то, чего не
// хватало, когда TP правились числом в поле.

import { prisma } from "./prisma";
import { currentTournament } from "./tournaments";
import { resolveUpload } from "./uploads";

export const TP_REASON = "tp";

/** Начисления TP игрокам за турнир: playerId → сумма. Турнир не задан — за всё время. */
export async function tpByTournament(tournamentId?: number | null): Promise<Map<number, number>> {
  // Суммируем в памяти, а не groupBy: строк реестра сотни, зато ветка одна и на sqlite,
  // и на любом другом драйвере — нам здесь нечего оптимизировать.
  const rows = await prisma.pointsEntry.findMany({
    where: { subjectType: "player", reason: TP_REASON, ...(tournamentId ? { tournamentId } : {}) },
    select: { subjectId: true, amount: true },
  });
  const totals = new Map<number, number>();
  for (const r of rows) totals.set(r.subjectId, (totals.get(r.subjectId) ?? 0) + r.amount);
  return totals;
}

/** Строка зачёта: место, игрок и его очки. */
export type TpRow = {
  place: number;
  id: number;
  slug: string;
  nickname: string;
  photo: string | null;
  score: number;
};

/**
 * Верхушка зачёта и место конкретного игрока — для витрины главной.
 *
 * Отдельно от страницы `/tp`: та рисует таблицу целиком и берёт весь ростер (`listPlayers`), а
 * витрине нужны пять строк и своя строка вошедшего. Тянуть ради них всех игроков лиги с составами
 * незачем — здесь запрашиваются только те, кто попал в выдачу.
 */
export async function tpLeaderboard(
  tournamentId?: number | null,
  opts: { limit?: number; playerId?: number | null } = {},
): Promise<{ rows: TpRow[]; me: TpRow | null; total: number }> {
  const limit = opts.limit ?? 5;
  const totals = await tpByTournament(tournamentId);
  // Ноль в зачёт не идёт: таблица про тех, кто уже что-то набрал.
  const ranked = [...totals.entries()].filter(([, score]) => score > 0).sort((a, b) => b[1] - a[1]);

  const meIndex = opts.playerId ? ranked.findIndex(([id]) => id === opts.playerId) : -1;
  const wanted = new Set(ranked.slice(0, limit).map(([id]) => id));
  if (meIndex >= 0) wanted.add(ranked[meIndex][0]);
  if (wanted.size === 0) return { rows: [], me: null, total: 0 };

  const players = await prisma.player.findMany({
    where: { id: { in: [...wanted] } },
    select: { id: true, slug: true, nickname: true, photo: true },
  });
  const byId = new Map(players.map((p) => [p.id, p]));

  const row = async (index: number): Promise<TpRow | null> => {
    const [id, score] = ranked[index];
    const p = byId.get(id);
    if (!p) return null; // игрока удалили, а начисления остались — в витрину такую строку не берём
    return {
      place: index + 1,
      id,
      slug: p.slug,
      nickname: p.nickname,
      photo: await resolveUpload("players", p.slug, "photo", p.photo),
      score,
    };
  };

  const rows = (await Promise.all(ranked.slice(0, limit).map((_, i) => row(i)))).filter((r): r is TpRow => r !== null);
  const me = meIndex >= 0 ? await row(meIndex) : null;
  return { rows, me, total: ranked.length };
}

/** История начислений игрока — что и за какой турнир. Для карточки игрока и разбора спорных мест. */
export const tpHistory = (playerId: number) =>
  prisma.pointsEntry.findMany({
    where: { subjectType: "player", reason: TP_REASON, subjectId: playerId },
    orderBy: { createdAt: "desc" },
    include: { tournament: true },
  });

/**
 * Поставить игроку итог за турнир. Пишем не «новое значение», а **разницу** отдельной строкой
 * реестра: корректировка — это новая запись, а не правка старой (так задуман `PointsEntry`).
 * Ноль-разницу не пишем, чтобы повторное сохранение той же цифры не плодило пустые строки.
 *
 * `Player.tp` после записи пересчитывается из реестра — кеш не должен расходиться с истиной.
 */
export async function setPlayerTp(playerId: number, total: number, opts: { tournamentId?: number | null; note?: string | null; by?: string | null } = {}) {
  const tournamentId = opts.tournamentId === undefined ? (await currentTournament())?.id ?? null : opts.tournamentId;

  const current = await prisma.pointsEntry.aggregate({
    where: { subjectType: "player", reason: TP_REASON, subjectId: playerId, tournamentId },
    _sum: { amount: true },
  });
  const delta = total - (current._sum.amount ?? 0);

  if (delta !== 0) {
    await prisma.pointsEntry.create({
      data: {
        subjectType: "player",
        subjectId: playerId,
        reason: TP_REASON,
        amount: delta,
        tournamentId,
        note: opts.note ?? null,
        createdBy: opts.by ?? null,
      },
    });
  }

  const all = await prisma.pointsEntry.aggregate({
    where: { subjectType: "player", reason: TP_REASON, subjectId: playerId },
    _sum: { amount: true },
  });
  return prisma.player.update({ where: { id: playerId }, data: { tp: all._sum.amount ?? 0 } });
}
