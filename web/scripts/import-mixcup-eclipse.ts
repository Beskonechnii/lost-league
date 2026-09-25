// Разовая заливка участников Mix Cup «Eclipse» напрямую в пул драфта — в обход обычного входа
// через сайт (Google/Steam → анкета → запись). Источник — анкеты из бота/формы, сведённые вручную
// в JSON (scratchpad), а не гугл-таблица сезона: sheet-to-roster.ts тут не подходит, формат другой.
//
// Запуск (из web/): npx tsx scripts/import-mixcup-eclipse.ts [--dry]
//
// Игрок сводится сперва по tgId (UserAccount.tgId, unique), потом по Player.telegram (многие в
// анкете — уже реальные verified-игроки лиги без аккаунта на сайте: у них есть Player.telegram, но
// нет UserAccount) — НИКОГДА по нику: совпадение ников в Dota обычное дело. Найден игрок —
// заводим ему только теневой UserAccount(source: telegram, status: draft) для связи, сам Player
// (ник, MMR) не трогаем — ростер лиги сильнее внешней формы. Не нашли вовсе — заводим и Player
// (verified: false, sourceTournamentId, MMR из анкеты — по умолчанию его ставит оператор при
// апруве, здесь исключение: без MMR микс не отбалансировать), и UserAccount.
// Идемпотентно по (tournamentId, accountId): TournamentRegistration.upsert.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { slugify } from "../src/lib/profiles";
import { joinRoleKeys, isRole, type RoleKey } from "../src/lib/roles";

const here = path.dirname(fileURLToPath(import.meta.url));
const dry = process.argv.includes("--dry");

const DATA_FILE =
  process.argv.find((a) => a.startsWith("--data="))?.slice("--data=".length) ??
  "/private/tmp/claude-501/-Users-admin-Desktop-GIT-Projects-LOST-lost-league/7627a5be-50c7-459b-8eed-e0bc825129cb/scratchpad/mixcup-eclipse-players.json";

const TOURNAMENT_SLUG = "eclipse";
const TOURNAMENT_NAME = "Mix Cup by Eclipse";

type Row = {
  userId: string;
  username: string;
  nickname: string;
  positions: string[];
  mmr: number | null;
  mmrRaw: string;
  captain: boolean;
  registeredAt: string | null;
};

// «Offlaner» из анкеты ≠ ключ роли «offlane» в коде — своя карта, а не roleByAnswer (та знает
// только «Offlane»/«Оффлейн»/номер позиции).
const ROLE_MAP: Record<string, RoleKey> = {
  carry: "carry",
  mid: "mid",
  offlaner: "offlane",
  offlane: "offlane",
  "soft-support": "soft-support",
  "hard-support": "hard-support",
};

function rolesOf(positions: string[]): string {
  const keys = positions.map((p) => ROLE_MAP[p.trim().toLowerCase()]).filter(isRole);
  return joinRoleKeys(keys);
}

async function uniqueSlug(db: PrismaClient, base: string): Promise<string> {
  const root = base || "player";
  let slug = root;
  for (let n = 2; await db.player.findUnique({ where: { slug }, select: { id: true } }); n++) {
    slug = `${root}-${n}`;
  }
  return slug;
}

async function main() {
  const raw = await fs.readFile(DATA_FILE, "utf8");
  const rows: Row[] = JSON.parse(raw);
  console.log(`Прочитано ${rows.length} игроков из ${DATA_FILE}`);

  const db = new PrismaClient({ adapter: new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }) });

  let tournament = await db.tournament.findUnique({ where: { slug: TOURNAMENT_SLUG } });
  if (!tournament) {
    console.log(`Турнира «${TOURNAMENT_SLUG}» нет — ${dry ? "будет заведён" : "завожу"}: ${TOURNAMENT_NAME}`);
    if (!dry) {
      tournament = await db.tournament.create({
        data: { slug: TOURNAMENT_SLUG, name: TOURNAMENT_NAME, kind: "mixcup", status: "registration" },
      });
    }
  } else if (tournament.kind !== "mixcup") {
    console.error(`Турнир «${TOURNAMENT_SLUG}» существует, но kind="${tournament.kind}", а не mixcup — стоп.`);
    process.exit(1);
  } else {
    console.log(`Турнир найден: #${tournament.id} ${tournament.name}`);
  }

  const attention: string[] = [];
  let created = 0;
  let reused = 0;
  let registered = 0;

  for (const r of rows) {
    const desiredRoles = rolesOf(r.positions) || null;
    if (!r.mmr) attention.push(`${r.nickname} (tg:${r.username || r.userId}) — MMR не распознан: «${r.mmrRaw}»`);

    let account = await db.userAccount.findUnique({ where: { tgId: r.userId } });
    let playerId: number;

    if (account?.playerId ?? account?.claimId) {
      playerId = (account.playerId ?? account.claimId)!;
      reused++;
    } else {
      const byTelegram = r.username
        ? await db.player.findFirst({ where: { telegram: { equals: r.username } }, select: { id: true, nickname: true } })
        : null;

      if (byTelegram) {
        playerId = byTelegram.id;
        if (byTelegram.nickname !== r.nickname)
          attention.push(`${r.nickname} — сведён по telegram с существующим игроком «${byTelegram.nickname}» (id ${byTelegram.id}), ник анкеты отличается`);
        if (dry) {
          console.log(`[dry] сведён по telegram: ${r.nickname} → «${byTelegram.nickname}» (id ${byTelegram.id})`);
          reused++;
          continue;
        }
        account = account
          ? await db.userAccount.update({ where: { id: account.id }, data: { playerId } })
          : await db.userAccount.create({
              data: { tgId: r.userId, tgUsername: r.username || null, name: byTelegram.nickname, source: "telegram", status: "draft", playerId },
            });
        reused++;
      } else {
        if (dry) {
          console.log(`[dry] новый: ${r.nickname} (tg:${r.username || r.userId}), mmr=${r.mmr ?? "—"}, роли=${desiredRoles ?? "—"}`);
          created++;
          continue;
        }

        const slug = await uniqueSlug(db, slugify(r.nickname));
        const player = await db.player.create({
          data: {
            slug,
            nickname: r.nickname,
            mmr: r.mmr,
            verified: false,
            sourceTournamentId: tournament!.id,
            telegram: r.username || null,
            mainRoles: desiredRoles,
          },
        });
        playerId = player.id;

        account = account
          ? await db.userAccount.update({ where: { id: account.id }, data: { playerId } })
          : await db.userAccount.create({
              data: { tgId: r.userId, tgUsername: r.username || null, name: r.nickname, source: "telegram", status: "draft", playerId },
            });
        created++;
      }
    }

    if (dry) continue;

    await db.tournamentRegistration.upsert({
      where: { tournamentId_accountId: { tournamentId: tournament!.id, accountId: account!.id } },
      create: { tournamentId: tournament!.id, accountId: account!.id, playerId, desiredRoles },
      update: { playerId, ...(desiredRoles ? { desiredRoles } : {}) },
    });
    registered++;
  }

  console.log(`\nГотово: новых профилей ${created}, сведено по tgId ${reused}, записей на турнир ${registered}${dry ? " (dry — ничего не записано)" : ""}`);
  if (attention.length) {
    console.log(`\nТребует внимания (${attention.length}):`);
    for (const line of attention) console.log(" -", line);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
