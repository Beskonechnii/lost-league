// Только сервер: похожие профили игроков и что с ними делать.
//
// Откуда берутся дубли. Ростер наполняется импортом таблицы сезона, а человек между сезонами меняет
// ник — и приезжает вторым профилем: `findPlayer` при апруве заявки узнаёт человека по `account_id`,
// но в таблице сезона его часто нет, а слаг ника у нового имени другой. Так у одного игрока
// расходятся места в составах, статистика карт и баллы.
//
// Поэтому очередь, а не автоматика: слить два профиля — операция необратимая (одна запись
// физически исчезает), и решать за оператора нельзя. Совпавший `account_id` — почти наверняка один
// человек, а общее реальное имя — это и два тёзки. Оператор видит признак и решает: объединить в
// один из профилей, переименовать (тогда это просто смена ника, данные и стата остаются) или
// сказать «разные люди» — тогда пара уходит в `PlayerDistinct` и больше не всплывает.

import { prisma } from "./prisma";
import { playerAccountId, slugify } from "./profiles";
import type { Candidate, Clue, Pair } from "./duplicate-clues";

export type { Candidate, Clue, Pair } from "./duplicate-clues";

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

/** Ник без разделителей и цифр: «Катюшка_1» и «катюшка» — один и тот же ник, набранный по-разному. */
const nickKey = (v: string) => slugify(v).replace(/[-\d]/g, "");

/**
 * Похожие пары по всему ростеру. Считается в памяти: 200 игроков — это 20 тысяч пар, дешевле, чем
 * четыре запроса с самосоединением, а SQLite всё равно не умеет сравнивать без учёта регистра.
 */
export async function duplicatesCount(): Promise<number> {
  return (await findDuplicates()).length;
}

export async function findDuplicates(): Promise<Pair[]> {
  const players = await prisma.player.findMany({
    include: {
      spots: { include: { team: { select: { name: true } } } },
      stats: { select: { id: true } },
    },
  });
  const dismissed = new Set(
    (await prisma.playerDistinct.findMany()).map((d) => `${d.aId}:${d.bId}`),
  );

  const candidate = (p: (typeof players)[number]): Candidate => ({
    id: p.id,
    nickname: p.nickname,
    realName: p.realName,
    // account_id часто лежит только в ссылке на профиль — берём выведенный, как это делает апрув.
    accountId: playerAccountId(p),
    telegram: p.telegram,
    mmr: p.mmr,
    tp: p.tp,
    spots: p.spots.length,
    stats: p.stats.length,
    teams: [...new Set(p.spots.map((s) => s.team.name))],
  });

  const pairs: Pair[] = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const one = candidate(players[i]);
      const two = candidate(players[j]);

      const clues: Clue[] = [];
      if (one.accountId && one.accountId === two.accountId) clues.push("account");
      if (one.telegram && norm(one.telegram) === norm(two.telegram)) clues.push("telegram");
      if (one.realName && norm(one.realName) === norm(two.realName)) clues.push("name");
      if (nickKey(one.nickname) && nickKey(one.nickname) === nickKey(two.nickname)) clues.push("nickname");
      if (clues.length === 0) continue;

      const [aId, bId] = one.id < two.id ? [one.id, two.id] : [two.id, one.id];
      if (dismissed.has(`${aId}:${bId}`)) continue;

      // Первым показываем тот профиль, за которым больше стоит: его логичнее оставить, и оператору
      // не придётся разбираться, какой из двух «настоящий».
      const weight = (c: Candidate) => c.stats * 10 + c.spots * 5 + (c.accountId ? 2 : 0) + (c.mmr ? 1 : 0);
      const [a, b] = weight(one) >= weight(two) ? [one, two] : [two, one];
      pairs.push({ a, b, clues });
    }
  }

  // Сильный признак наверх: с account_id решение очевидно, с тёзками нужно думать.
  const rank = (p: Pair) => (p.clues.includes("account") ? 0 : p.clues.includes("telegram") ? 1 : 2);
  return pairs.sort((x, y) => rank(x) - rank(y) || y.a.stats - x.a.stats);
}

/**
 * Что переедет при слиянии и что схлопнется — показывается в очереди: операция необратима, и
 * «одно место пропадёт» оператор должен видеть заранее. Схлопывается то, что у победителя уже есть:
 * место в той же команде того же сезона и строка статистики той же карты.
 */
export async function mergeImpact(winnerId: number, loserId: number) {
  const [loserSpots, winnerSpots, loserStats, winnerStats, points] = await Promise.all([
    prisma.rosterSpot.findMany({ where: { playerId: loserId }, select: { teamId: true, divisionId: true } }),
    prisma.rosterSpot.findMany({ where: { playerId: winnerId }, select: { teamId: true, divisionId: true } }),
    prisma.matchStat.findMany({ where: { playerId: loserId }, select: { matchId: true } }),
    prisma.matchStat.findMany({ where: { playerId: winnerId }, select: { matchId: true } }),
    prisma.pointsEntry.count({ where: { subjectType: "player", subjectId: loserId } }),
  ]);
  const occupied = new Set(winnerSpots.map((s) => `${s.teamId}:${s.divisionId ?? "-"}`));
  const played = new Set(winnerStats.map((s) => s.matchId));
  const dropped =
    loserSpots.filter((s) => occupied.has(`${s.teamId}:${s.divisionId ?? "-"}`)).length +
    loserStats.filter((s) => played.has(s.matchId)).length;

  return {
    spots: loserSpots.filter((s) => !occupied.has(`${s.teamId}:${s.divisionId ?? "-"}`)).length,
    stats: loserStats.filter((s) => !played.has(s.matchId)).length,
    points,
    dropped,
  };
}

/**
 * Слить `loserId` в `winnerId`: всё, что ссылалось на первого, переезжает ко второму, первый
 * удаляется. Пустые поля победителя дополняются данными донора — при смене ника новый профиль часто
 * богаче старого (свежие ссылки), а старый держит стату сезонов.
 *
 * `PointsEntry` переносим руками: там не связь, а пара «тип + id» (реестр общий на команды, игроков
 * и кастеров), и каскад про неё не знает. `Player.tp` после переноса пересчитываем из реестра —
 * это кеш суммы, и сложить две цифры мало: у обоих профилей он мог разъехаться с истиной.
 */
export async function mergePlayers(winnerId: number, loserId: number) {
  if (winnerId === loserId) throw new Error("Это один и тот же профиль");
  const [winner, loser] = await Promise.all([
    prisma.player.findUnique({ where: { id: winnerId } }),
    prisma.player.findUnique({ where: { id: loserId } }),
  ]);
  if (!winner || !loser) throw new Error("Профиль не найден");

  // Места в составах: одно и то же место у обоих (одна команда, один дивизион) — это и есть дубль,
  // лишнее удаляем, иначе упрёмся в @@unique([teamId, playerId, divisionId]).
  const loserSpots = await prisma.rosterSpot.findMany({ where: { playerId: loserId } });
  const winnerSpots = await prisma.rosterSpot.findMany({ where: { playerId: winnerId } });
  const occupied = new Set(winnerSpots.map((s) => `${s.teamId}:${s.divisionId ?? "-"}`));

  // То же с картами: если оба профиля попали в стату одной карты, у победителя строка уже есть.
  const loserStats = await prisma.matchStat.findMany({ where: { playerId: loserId } });
  const winnerMatches = new Set(
    (await prisma.matchStat.findMany({ where: { playerId: winnerId }, select: { matchId: true } })).map((s) => s.matchId),
  );

  const filled = <T,>(mine: T | null, theirs: T | null): T | null => mine ?? theirs;

  await prisma.$transaction([
    ...loserSpots.map((s) =>
      occupied.has(`${s.teamId}:${s.divisionId ?? "-"}`)
        ? prisma.rosterSpot.delete({ where: { id: s.id } })
        : prisma.rosterSpot.update({ where: { id: s.id }, data: { playerId: winnerId } }),
    ),
    ...loserStats.map((s) =>
      winnerMatches.has(s.matchId)
        ? prisma.matchStat.delete({ where: { id: s.id } })
        : prisma.matchStat.update({ where: { id: s.id }, data: { playerId: winnerId } }),
    ),
    prisma.pointsEntry.updateMany({
      where: { subjectType: "player", subjectId: loserId },
      data: { subjectId: winnerId },
    }),
    // Привязка аккаунта уникальна: если вход есть у обоих, аккаунт донора отцепляем — иначе
    // упрёмся в @@unique, а живой вход победителя дороже.
    prisma.userAccount.updateMany({ where: { claimId: loserId }, data: { claimId: winnerId } }),
    prisma.player.update({
      where: { id: winnerId },
      data: {
        realName: filled(winner.realName, loser.realName),
        accountId: filled(winner.accountId, loser.accountId),
        mmr: filled(winner.mmr, loser.mmr),
        rank: filled(winner.rank, loser.rank),
        photo: filled(winner.photo, loser.photo),
        steamUrl: filled(winner.steamUrl, loser.steamUrl),
        dotabuffUrl: filled(winner.dotabuffUrl, loser.dotabuffUrl),
        stratzUrl: filled(winner.stratzUrl, loser.stratzUrl),
        telegram: filled(winner.telegram, loser.telegram),
        birthday: filled(winner.birthday, loser.birthday),
        city: filled(winner.city, loser.city),
        country: filled(winner.country, loser.country),
        banner: filled(winner.banner, loser.banner),
        interviewUrl: filled(winner.interviewUrl, loser.interviewUrl),
        achievements: filled(winner.achievements, loser.achievements),
        tags: filled(winner.tags, loser.tags),
      },
    }),
    prisma.player.delete({ where: { id: loserId } }),
  ]);

  // Кеш очков пересчитываем после переноса, отдельным шагом: реестр — истина, поле лишь витрина.
  const sum = await prisma.pointsEntry.aggregate({
    where: { subjectType: "player", subjectId: winnerId, reason: "tp" },
    _sum: { amount: true },
  });
  await prisma.player.update({ where: { id: winnerId }, data: { tp: sum._sum.amount ?? 0 } });

  // Пары с удалённым больше не существует — чистим прошлые «разные люди», чтобы не копить мусор.
  await prisma.playerDistinct.deleteMany({ where: { OR: [{ aId: loserId }, { bId: loserId }] } });

  return prisma.player.findUnique({ where: { id: winnerId } });
}

/** Сменить ник профилю: данные и стата остаются на месте — меняется только подпись. */
export async function renamePlayer(playerId: number, nickname: string) {
  const name = nickname.trim();
  if (!name) throw new Error("Ник пустой");
  return prisma.player.update({ where: { id: playerId }, data: { nickname: name } });
}

/** «Разные люди»: пара уходит из очереди навсегда. */
export async function dismissPair(oneId: number, twoId: number, decidedById: number | null) {
  const [aId, bId] = oneId < twoId ? [oneId, twoId] : [twoId, oneId];
  return prisma.playerDistinct.upsert({
    where: { aId_bId: { aId, bId } },
    create: { aId, bId, decidedById },
    update: { decidedById, decidedAt: new Date() },
  });
}
