// Снимок БД → data/snapshot.json, чтобы состояние лиги переносилось между устройствами через git.
//
// Запуск (из web/):
//   npx tsx scripts/export-db.ts [--out <путь>]
//
// Зачем: dev.db в .gitignore (это данные, а не исходники), но всё, что заводят руками в UI —
// счета серий, правки ростера, баллы — живёт только в нём. Без снимка такие правки не уезжают
// на второе устройство и теряются вместе с диском.
//
// Главное решение: в снимке НЕТ числовых id. Они автоинкрементные и на каждой машине свои,
// поэтому связи пишем по `slug` (сквозной ключ проекта), а матчи — по openDotaMatchId либо
// по синтетическому ключу из команд и даты. Обратная операция — scripts/import-db.ts.

import { writeFileSync } from "node:fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";

const args = process.argv.slice(2);
const arg = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const out = arg("--out") ?? "data/snapshot.json";

const prisma = new PrismaClient({
  adapter: new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

// Матч — единственная сущность без надёжного естественного ключа: openDotaMatchId может быть пустым
// у ещё не сыгранной встречи. Тогда собираем ключ из участников и даты — этого хватает, чтобы
// повторный импорт узнал ту же строку, а не создал дубль.
const matchKey = (m: { openDotaMatchId: string | null; scheduledAt: Date | null }, a: string, b: string) =>
  m.openDotaMatchId ?? `${a}|${b}|${m.scheduledAt?.toISOString() ?? "tbd"}`;

// У серии, в отличие от матча, естественный ключ есть свой — `slug` (src/lib/series.ts). Он же
// стоит в адресе `/series/<slug>`, поэтому важно, чтобы снимок переносил его как есть: пересчёт
// на другой машине мог бы дать другой хвост и сломать уже отданные наружу ссылки.

// Выкинуть поля явно. Через деструктуризацию (`const { id, ...rest }`) короче, но линт справедливо
// ругается на неиспользуемую переменную — а глушить его ради стиля хуже, чем написать хелпер.
function omit<T extends object, K extends keyof T>(row: T, ...keys: K[]): Omit<T, K> {
  const copy = { ...row };
  for (const k of keys) delete copy[k];
  return copy;
}

async function main() {
  const [teams, players, spots, matches, groupEntries, series, stats, points, renders, wards, accounts, tournaments, entries, applications] =
    await Promise.all([
      prisma.team.findMany({ orderBy: { slug: "asc" } }),
      prisma.player.findMany({ orderBy: { slug: "asc" } }),
      prisma.rosterSpot.findMany({ include: { team: true, player: true, division: { include: { tournament: true } } } }),
      prisma.match.findMany({
        include: { teamA: true, teamB: true, winner: true, radiantTeam: true, series: { select: { slug: true } } },
      }),
      prisma.groupEntry.findMany({ include: { team: true } }),
      prisma.series.findMany({ include: { home: true, away: true } }),
      prisma.matchStat.findMany({ include: { player: true, match: { include: { teamA: true, teamB: true } } } }),
      prisma.pointsEntry.findMany({ include: { match: { include: { teamA: true, teamB: true } }, tournament: true } }),
      prisma.render.findMany({ include: { match: { include: { teamA: true, teamB: true } } } }),
      prisma.ward.findMany({ include: { team: true, match: { include: { teamA: true, teamB: true } } } }),
      prisma.userAccount.findMany({ include: { player: true, claim: true } }),
      prisma.tournament.findMany({ orderBy: { slug: "asc" }, include: { divisions: { orderBy: { orderNo: "asc" } } } }),
      prisma.tournamentEntry.findMany({ include: { team: true, division: { include: { tournament: true } } } }),
      prisma.teamApplication.findMany({
        include: { team: true, tournament: true, division: { include: { tournament: true } } },
      }),
    ]);

  // Дивизион в связях — пара «слаг турнира / слаг дивизиона»: id автоинкрементные и на другой
  // машине другие, а слаг дивизиона уникален только внутри своего турнира.
  const divKey = (d: { slug: string; tournament: { slug: string } } | null | undefined) =>
    d ? `${d.tournament.slug}/${d.slug}` : null;
  const divById = new Map(
    tournaments.flatMap((t) => t.divisions.map((d) => [d.id, `${t.slug}/${d.slug}`] as const)),
  );

  // Баллы ссылаются на субъекта сырым id + типом, без relation — разворачиваем в slug вручную.
  const teamById = new Map(teams.map((t) => [t.id, t.slug]));
  const playerById = new Map(players.map((p) => [p.id, p.slug]));
  const keyOfMatch = (m: { openDotaMatchId: string | null; scheduledAt: Date | null; teamA: { slug: string }; teamB: { slug: string } }) =>
    matchKey(m, m.teamA.slug, m.teamB.slug);

  const snapshot = {
    version: 14, // 14 — сезонные составы (divisionKey у RosterSpot) и турнирный зачёт TP (tournamentSlug у начислений)
    exportedAt: new Date().toISOString(),

    teams: teams.map((t) => omit(t, "id")),
    players: players.map((p) => omit(p, "id")),

    rosterSpots: spots
      .map((s) => ({
        teamSlug: s.team.slug,
        playerSlug: s.player.slug,
        // Состав сезонный: место принадлежит дивизиону турнира. Ключ — «турнир/дивизион», как везде.
        divisionKey: divKey(s.division),
        role: s.role,
        isCaptain: s.isCaptain,
        createdAt: s.createdAt,
      }))
      .sort((a, b) => `${a.teamSlug}${a.playerSlug}`.localeCompare(`${b.teamSlug}${b.playerSlug}`)),

    matches: matches
      .map((m) => ({
        key: keyOfMatch(m),
        openDotaMatchId: m.openDotaMatchId,
        scheduledAt: m.scheduledAt,
        status: m.status,
        createdAt: m.createdAt,
        teamASlug: m.teamA.slug,
        teamBSlug: m.teamB.slug,
        winnerSlug: m.winner?.slug ?? null,
        radiantSlug: m.radiantTeam?.slug ?? null,
        startedAt: m.startedAt,
        durationSec: m.durationSec,
        radiantScore: m.radiantScore,
        direScore: m.direScore,
        firstPickRadiant: m.firstPickRadiant,
        seriesSlug: m.series?.slug ?? null,
        gameNumber: m.gameNumber,
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),

    tournaments: tournaments.map((t) => ({
      ...omit(t, "id", "divisions"),
      divisions: t.divisions.map((d) => omit(d, "id", "tournamentId")),
    })),

    tournamentEntries: entries
      .map((e) => ({
        divisionKey: divKey(e.division),
        teamSlug: e.team.slug,
        seed: e.seed,
        group: e.group,
        createdAt: e.createdAt,
      }))
      .sort((a, b) => `${a.divisionKey}${a.teamSlug}`.localeCompare(`${b.divisionKey}${b.teamSlug}`)),

    teamApplications: applications
      .map((a) => ({
        // reviewedById/submittedById не переносим: это id аккаунтов, а они на машинах разные —
        // след в истории, а не связь (то же правило, что у UserAccount.reviewedById).
        ...omit(a, "id", "tournamentId", "divisionId", "teamId", "tournament", "division", "team", "reviewedById", "submittedById"),
        tournamentSlug: a.tournament.slug,
        divisionKey: divKey(a.division),
        teamSlug: a.team?.slug ?? null,
      }))
      .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime()),

    groupEntries: groupEntries
      .map((g) => ({ ...omit(g, "id", "teamId", "team", "divisionId"), teamSlug: g.team.slug, divisionKey: divById.get(g.divisionId ?? -1) ?? null }))
      .sort((a, b) => `${a.division}${a.group}${a.place}`.localeCompare(`${b.division}${b.group}${b.place}`)),

    series: series
      .map((s) => ({
        ...omit(s, "id", "homeId", "awayId", "home", "away", "divisionId"),
        homeSlug: s.home.slug,
        awaySlug: s.away.slug,
        divisionKey: divById.get(s.divisionId ?? -1) ?? null,
      }))
      .sort((a, b) => a.slug.localeCompare(b.slug)),

    matchStats: stats
      .map((s) => ({ ...omit(s, "id", "matchId", "playerId", "match", "player"), matchKey: keyOfMatch(s.match), playerSlug: s.player.slug }))
      .sort((a, b) => `${a.matchKey}${a.playerSlug}`.localeCompare(`${b.matchKey}${b.playerSlug}`)),

    pointsEntries: points
      .map((p) => ({
        ...omit(p, "id", "matchId", "match", "subjectId", "tournamentId", "tournament"),
        // Турнир — по слагу: id на машинах разные (то же правило, что у дивизионов).
        tournamentSlug: p.tournament?.slug ?? null,
        // team | player разворачиваем в slug; caster/streamer пока не имеют своей таблицы — оставляем id как есть.
        subjectSlug:
          p.subjectType === "team" ? teamById.get(p.subjectId) ?? null
          : p.subjectType === "player" ? playerById.get(p.subjectId) ?? null
          : null,
        subjectRawId: p.subjectId,
        matchKey: p.match ? keyOfMatch(p.match) : null,
      }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),

    renders: renders
      .map((r) => ({ ...omit(r, "id", "matchId", "match"), matchKey: r.match ? keyOfMatch(r.match) : null }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),

    wards: wards
      .map((w) => ({
        ...omit(w, "id", "matchId", "teamId", "team", "match"),
        matchKey: keyOfMatch(w.match),
        teamSlug: w.team?.slug ?? null, // сторону не распознали → вард без команды
      }))
      .sort((a, b) => `${a.matchKey}${a.placed}${a.x}${a.y}`.localeCompare(`${b.matchKey}${b.placed}${b.x}${b.y}`)),

    // Аккаунты — реальные данные пользователей, а не производные: должны переживать db:import (зеркало),
    // иначе привязки и пароли потерялись бы. Ключей переноса теперь два: email и tgId (у аккаунта из
    // бота почты нет вовсе), профиль/заявка — по slug игрока. `reviewedById` не переносим: это id
    // аккаунта, а id на другой машине другие — след «кто рассмотрел» не связь.
    accounts: accounts
      .map((a) => ({
        email: a.email,
        googleSub: a.googleSub,
        tgId: a.tgId,
        tgUsername: a.tgUsername,
        source: a.source,
        passwordHash: a.passwordHash,
        emailVerified: a.emailVerified,
        name: a.name,
        avatar: a.avatar,
        role: a.role,
        permissions: a.permissions,
        status: a.status,
        application: a.application,
        policyAcceptedAt: a.policyAcceptedAt,
        submittedAt: a.submittedAt,
        reviewedAt: a.reviewedAt,
        rejectedReason: a.rejectedReason,
        createdAt: a.createdAt,
        playerSlug: a.player?.slug ?? null,
        claimSlug: a.claim?.slug ?? null,
      }))
      // Сортируем по тому ключу, который есть: у телеграмного аккаунта почты нет.
      .sort((a, b) => (a.email ?? a.tgId ?? "").localeCompare(b.email ?? b.tgId ?? "")),
  };

  writeFileSync(out, JSON.stringify(snapshot, null, 2) + "\n", "utf8");

  console.log(`Снимок записан в ${out}`);
  console.table({
    команды: snapshot.teams.length,
    игроки: snapshot.players.length,
    составы: snapshot.rosterSpots.length,
    матчи: snapshot.matches.length,
    "группы (строки)": snapshot.groupEntries.length,
    встречи: snapshot.series.length,
    "стата матчей": snapshot.matchStats.length,
    баллы: snapshot.pointsEntries.length,
    генерации: snapshot.renders.length,
    варды: snapshot.wards.length,
    аккаунты: snapshot.accounts.length,
    турниры: snapshot.tournaments.length,
    "участие команд": snapshot.tournamentEntries.length,
    "заявки команд": snapshot.teamApplications.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
