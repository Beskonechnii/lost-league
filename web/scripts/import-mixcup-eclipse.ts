// Синк участников Mix Cup «Eclipse» из гугл-таблицы анкет прямо в пул драфта — в обход обычного
// входа через сайт (Google/Steam → анкета → запись). Таблица — шаблон пула: правится там, потом
// скрипт перезапускается. sheet-to-roster.ts тут не подходит: формат другой, это анкеты, а не ростер.
// Таблица должна быть открыта по ссылке (читаем CSV-экспорт без ключей).
//
// Запуск (из web/): npx tsx scripts/import-mixcup-eclipse.ts [--dry] [--also=mixcup-58,mixcup-59]
//   --also   — те же записи и в эти Mix Cup'ы: заведённые раньше, чем эталон eclipse был заполнен,
//              наследства не получили (новый mixcup копирует пул эталона только при создании).
//   --sheet= — другая таблица/лист (ссылка на CSV-экспорт).
//
// Игрок сводится сперва по tgId (UserAccount.tgId, unique), потом по Player.telegram (многие в
// анкете — уже реальные verified-игроки лиги без аккаунта на сайте: у них есть Player.telegram, но
// нет UserAccount) — НИКОГДА по нику: совпадение ников в Dota обычное дело. Найден игрок —
// заводим ему только теневой UserAccount(source: telegram, status: draft) для связи; если это
// РЕАЛЬНЫЙ игрок лиги (не наш теневой профиль) — ник и MMR не трогаем, ростер сильнее внешней
// формы; если это наш же теневой профиль с прошлого запуска (verified: false,
// sourceTournamentId = этот турнир) — обновляем MMR/роли из анкеты, таблица источник правды для
// своих. Не нашли вовсе — заводим и Player, и UserAccount.
// Таблица — источник правды по составу: кого в ней больше нет — снимаем с турнира (регистрацию, не
// профиль). Идемпотентно по (tournamentId, accountId): TournamentRegistration.upsert.

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { slugify } from "../src/lib/profiles";
import { joinRoleKeys, isRole, type RoleKey } from "../src/lib/roles";

const dry = process.argv.includes("--dry");

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SHEET_URL =
  arg("sheet") ??
  "https://docs.google.com/spreadsheets/d/16okHkW4HJDCJUf83WW0K4-lC_lFdvK923JFp9uQRMSw/export?format=csv&gid=176774400";
const ALSO = (arg("also") ?? "").split(",").filter(Boolean);

const TOURNAMENT_SLUG = "eclipse";
const TOURNAMENT_NAME = "Mix Cup by Eclipse";

type Row = {
  userId: string;
  username: string;
  nickname: string;
  positions: string[];
  mmr: number | null;
  mmrRaw: string;
};

// Минимальный CSV: кавычки с запятыми внутри («Mid, Soft-support») и "" как экранирование.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") endCell();
    else if (c === "\n") {
      endCell();
      rows.push(row);
      row = [];
    } else if (c !== "\r") cell += c;
  }
  if (cell || row.length) {
    endCell();
    rows.push(row);
  }
  return rows;
}

// tgId прошлого прогона пришёл из xlsx как число и записался строкой «2.14971714E8» — такой
// аккаунт бот по настоящему id не узнает. Здесь и в базе id — только целое строкой.
const normTgId = (v: string) => (/e/i.test(v) ? String(Math.round(Number(v))) : v.trim());

async function readSheet(): Promise<Row[]> {
  const res = await fetch(SHEET_URL);
  if (!res.ok) throw new Error(`Таблица не отдалась: HTTP ${res.status} — открыта ли она по ссылке?`);
  const [head, ...body] = parseCsv(await res.text());
  const col = (name: string) => {
    const i = head.findIndex((h) => h.trim() === name);
    if (i < 0) throw new Error(`В таблице нет колонки «${name}»`);
    return i;
  };
  const [cId, cUser, cNick, cPos, cMmr] = ["User_id", "username", "Игрок", "Позиция", "MMR"].map(col);
  return body
    .filter((r) => r[cId]?.trim())
    .map((r) => {
      const mmrRaw = r[cMmr]?.trim() ?? "";
      return {
        userId: normTgId(r[cId]),
        username: r[cUser]?.trim() ?? "",
        nickname: r[cNick].trim(),
        positions: (r[cPos] ?? "").split(",").map((p) => p.trim()).filter(Boolean),
        mmr: /^\d+$/.test(mmrRaw) ? Number(mmrRaw) : null,
        mmrRaw,
      };
    });
}

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
  const rows = await readSheet();
  console.log(`Прочитано ${rows.length} игроков из таблицы`);

  const db = new PrismaClient({ adapter: new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }) });

  for (const a of await db.userAccount.findMany({ where: { tgId: { contains: "E" } }, select: { id: true, tgId: true } })) {
    const tgId = normTgId(a.tgId!);
    console.log(`${dry ? "[dry] " : ""}tgId ${a.tgId} → ${tgId}`);
    if (!dry) await db.userAccount.update({ where: { id: a.id }, data: { tgId } });
  }

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
  const entries: { accountId: number; playerId: number; desiredRoles: string | null }[] = [];

  for (const r of rows) {
    const desiredRoles = rolesOf(r.positions) || null;
    if (!r.mmr) attention.push(`${r.nickname} (tg:${r.username || r.userId}) — MMR не распознан: «${r.mmrRaw}»`);

    let account = await db.userAccount.findUnique({ where: { tgId: r.userId } });
    let playerId: number;

    if (account?.playerId ?? account?.claimId) {
      playerId = (account.playerId ?? account.claimId)!;
      reused++;

      const player = await db.player.findUnique({ where: { id: playerId }, select: { verified: true, sourceTournamentId: true } });
      // sourceTournamentId === null — теневой профиль, чей эталон eclipse однажды удалили кнопкой
      // (связь SetNull): он всё ещё наш, иначе MMR/роли из таблицы до него больше не доедут.
      const ourShadow =
        player && !player.verified && (player.sourceTournamentId === null || player.sourceTournamentId === tournament?.id);
      if (ourShadow && !dry) {
        await db.player.update({ where: { id: playerId }, data: { nickname: r.nickname, mmr: r.mmr, mainRoles: desiredRoles } });
      } else if (ourShadow && dry) {
        console.log(`[dry] обновлён (наш теневой): ${r.nickname}, mmr=${r.mmr ?? "—"}, роли=${desiredRoles ?? "—"}`);
      }
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
    entries.push({ accountId: account!.id, playerId, desiredRoles });
  }

  const targets = [tournament, ...(await Promise.all(ALSO.map((slug) => db.tournament.findUnique({ where: { slug } }))))];
  ALSO.forEach((slug, i) => {
    if (targets[i + 1]?.kind !== "mixcup") throw new Error(`--also: «${slug}» — не Mix Cup или не найден`);
  });

  const currentUserIds = new Set(rows.map((r) => r.userId));
  for (const t of targets) {
    if (!t) continue;
    for (const e of entries) {
      await db.tournamentRegistration.upsert({
        where: { tournamentId_accountId: { tournamentId: t.id, accountId: e.accountId } },
        create: { tournamentId: t.id, ...e },
        update: { playerId: e.playerId, ...(e.desiredRoles ? { desiredRoles: e.desiredRoles } : {}) },
      });
      registered++;
    }
    const existing = await db.tournamentRegistration.findMany({
      where: { tournamentId: t.id },
      select: { id: true, account: { select: { tgId: true } }, player: { select: { nickname: true } } },
    });
    const stale = existing.filter((e) => !e.account.tgId || !currentUserIds.has(e.account.tgId));
    if (stale.length) {
      console.log(`\n${t.slug}: ${dry ? "[dry] будут сняты" : "сняты"} (нет в актуальном списке): ${stale.length}`);
      for (const e of stale) console.log(" -", e.player.nickname);
      if (!dry) await db.tournamentRegistration.deleteMany({ where: { id: { in: stale.map((e) => e.id) } } });
    }
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
