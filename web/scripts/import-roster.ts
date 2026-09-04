// Импорт составов: data/roster.json → БД. Идемпотентно (upsert по slug), повторный запуск обновляет.
//
// Запуск (из web/):  npx tsx scripts/import-roster.ts
//   --file <path>   другой файл вместо data/roster.json
//   --dry           только показать, что произойдёт
//
// Картинки скрипт НЕ трогает: logo/wordmark/photo заливает scripts/import-media.ts,
// пустые поля из json их не затирают.
//
// Кого считать «тем же человеком». Раньше ключом был только слаг ника — а ник между сезонами
// меняется, и таблица привозила второго профиля тому, кто уже есть в базе (отсюда очередь на
// /admin/duplicates). Теперь перед записью идёт ШАГ ОБОГАЩЕНИЯ: у каждой строки вычисляется
// account_id — из поля или из ссылки на Dotabuff/Stratz/Steam (`playerAccountId`, то же место
// правды, что у апрува заявки), — и человек ищется сперва по нему, и только потом по слагу.
// Порядок тот же, что в `findPlayer` (src/lib/team-application.ts): два пути записи ростера
// обязаны узнавать людей одинаково.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import { playerAccountId, slugify } from "../src/lib/profiles";
import { isRole } from "../src/lib/roles";
import { isCoreRole } from "../src/lib/roster-spots";

type PlayerInput = {
  slug?: string;
  nickname: string;
  realName?: string | null;
  accountId?: string | number | null;
  mmr?: number | string | null;
  role?: string | null; // carry | mid | offlane | soft-support | hard-support | coach | standin
  isCaptain?: boolean;
  telegram?: string | null;
  steamUrl?: string | null;
  dotabuffUrl?: string | null;
  stratzUrl?: string | null;
};
type TeamInput = {
  slug?: string;
  name: string;
  tag?: string | null;
  group?: string | null;
  color?: string | null;
  players?: PlayerInput[];
};

const here = path.dirname(fileURLToPath(import.meta.url)); // web/scripts
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const fileArg = args[args.indexOf("--file") + 1];
const file = path.resolve(here, "..", args.includes("--file") && fileArg ? fileArg : "data/roster.json");

const prisma = new PrismaClient({
  adapter: new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

const stat = { teamsNew: 0, teamsUpd: 0, playersNew: 0, playersUpd: 0, spotsGone: 0 };
const warnings: string[] = [];
/** «teamId:playerId» мест, которые есть в файле — всё остальное в этих командах вычищаем после импорта. */
const seenSpots = new Set<string>();

// null и "" из json трактуем одинаково: «значение задано, но пустое» → пишем null.
// undefined = «поля нет в json» → поле не трогаем (важно для повторного импорта).
const clean = (v: string | number | null | undefined) => {
  if (v === undefined) return undefined;
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

async function importTeam(t: TeamInput) {
  const slug = t.slug?.trim() || slugify(t.name);
  if (!slug) throw new Error(`Команда «${t.name}»: не получается вывести slug — задайте его явно`);

  const data = { name: t.name.trim(), tag: clean(t.tag), group: clean(t.group), color: clean(t.color) };
  const existing = await prisma.team.findUnique({ where: { slug } });

  if (dry) {
    console.log(`  ${existing ? "обновить" : "создать "} команду ${slug} — ${data.name}`);
  } else if (existing) {
    await prisma.team.update({ where: { slug }, data });
  } else {
    await prisma.team.create({ data: { slug, ...data } });
  }
  if (existing) stat.teamsUpd++;
  else stat.teamsNew++;

  const teamId = existing?.id ?? (dry ? -1 : (await prisma.team.findUniqueOrThrow({ where: { slug } })).id);

  for (const p of t.players ?? []) await importPlayer(p, teamId, slug);
}

/**
 * account_id строки файла «по всему, что о ней известно»: своё поле, иначе разобранное из ссылки на
 * профиль — в таблице сезона номера часто нет, зато есть гиперссылка на Dotabuff (её и вытаскивает
 * scripts/sheet-to-roster.ts). Без этого шага человек со сменившимся ником не находится.
 */
const identityOf = (p: PlayerInput) =>
  playerAccountId({
    accountId: clean(p.accountId) ?? null,
    dotabuffUrl: clean(p.dotabuffUrl) ?? null,
    stratzUrl: clean(p.stratzUrl) ?? null,
    steamUrl: clean(p.steamUrl) ?? null,
  });

/** Живущие в БД профили по account_id. Строится один раз, пополняется по мере создания новых. */
const byAccount = new Map<string, { id: number; slug: string; nickname: string }>();

async function loadIdentities() {
  const players = await prisma.player.findMany({
    select: { id: true, slug: true, nickname: true, accountId: true, dotabuffUrl: true, stratzUrl: true, steamUrl: true },
  });
  for (const pl of players) {
    const id = playerAccountId(pl);
    // Двух профилей на один id быть не должно; если они есть — это работа для /admin/duplicates,
    // а импорт держится первого и говорит об этом вслух.
    if (!id) continue;
    const twin = byAccount.get(id);
    if (twin) {
      warnings.push(`account_id ${id} у двух профилей — «${twin.slug}» и «${pl.slug}»; разберите на /admin/duplicates`);
      continue;
    }
    byAccount.set(id, { id: pl.id, slug: pl.slug, nickname: pl.nickname });
  }
}

/** Свободный слаг: ник занят другим человеком — берём суффикс (то же правило, что у апрува заявки). */
async function freePlayerSlug(nickname: string) {
  const base = slugify(nickname) || "player";
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    if (!(await prisma.player.findUnique({ where: { slug } }))) return slug;
  }
}

async function importPlayer(p: PlayerInput, teamId: number, teamSlug: string) {
  const nickSlug = p.slug?.trim() || slugify(p.nickname);
  if (!nickSlug) throw new Error(`Игрок «${p.nickname}» (${teamSlug}): не получается вывести slug — задайте его явно`);

  const identity = identityOf(p);
  if (!identity) warnings.push(`${teamSlug}/${nickSlug}: нет accountId — синк статы из OpenDota для него не сработает`);
  if (p.role && !isRole(p.role)) warnings.push(`${teamSlug}/${nickSlug}: неизвестная роль «${p.role}» — записал пустой`);

  // Кого дополняем. Слаг, выписанный в файле руками, — это указание пальцем, он главнее всего.
  // Дальше account_id (не меняется), и только потом слаг ника (меняется каждый сезон).
  const pinned = p.slug?.trim() ? await prisma.player.findUnique({ where: { slug: nickSlug } }) : null;
  const known = identity ? byAccount.get(identity) : undefined;
  const byNick = pinned ?? (known ? null : await prisma.player.findUnique({ where: { slug: nickSlug } }));

  let existing = pinned ?? (known ? await prisma.player.findUnique({ where: { id: known.id } }) : byNick);

  // Тёзки: слаг совпал, а номера разные — это разные люди, и перезаписать одного другим значит
  // потерять профиль вместе со статой. Заводим отдельного, слаг с суффиксом.
  let slug = existing?.slug ?? nickSlug;
  if (!known && byNick && identity && playerAccountId(byNick) && playerAccountId(byNick) !== identity) {
    warnings.push(
      `${teamSlug}/${nickSlug}: ник занят другим человеком (account_id ${playerAccountId(byNick)} ≠ ${identity}) — ` +
        `завёл отдельный профиль`,
    );
    existing = null;
    slug = dry ? `${nickSlug}-2` : await freePlayerSlug(p.nickname);
  }
  if (existing && known && existing.slug !== nickSlug) {
    warnings.push(`${teamSlug}/${nickSlug}: узнан по account_id как «${existing.slug}» — сменился ник, профиль тот же`);
  }

  // Карточка игрока — про человека; роль и капитанство лежат на месте в составе (RosterSpot).
  const data = {
    nickname: p.nickname.trim(),
    realName: clean(p.realName),
    // Обогащение: разобранный из ссылки номер записываем в поле — дальше человек ищется по нему
    // сразу, без разбора ссылок, и синк статы видит его без правки руками.
    accountId: identity ?? clean(p.accountId),
    mmr: mmrOf(p.mmr),
    telegram: clean(p.telegram),
    steamUrl: clean(p.steamUrl),
    dotabuffUrl: clean(p.dotabuffUrl),
    stratzUrl: clean(p.stratzUrl),
  };
  const role = isRole(p.role) ? p.role : null;

  if (dry) {
    console.log(`    ${existing ? "обновить" : "создать "} игрока  ${slug} — ${data.nickname} (${role ?? "без роли"})`);
    if (existing) stat.playersUpd++;
    else stat.playersNew++;
    return;
  }

  const player = existing
    ? await prisma.player.update({ where: { id: existing.id }, data })
    : await prisma.player.create({ data: { slug, ...data } });
  if (existing) stat.playersUpd++;
  else stat.playersNew++;
  if (identity && !byAccount.has(identity)) byAccount.set(identity, { id: player.id, slug: player.slug, nickname: player.nickname });

  // Состав сезонный: место заводим в дивизион, где команда участвует сейчас (нет участия — NULL).
  const entry = await prisma.tournamentEntry.findFirst({ where: { teamId } });
  const divisionId = entry?.divisionId ?? null;
  const existingSpot = await prisma.rosterSpot.findFirst({ where: { teamId, playerId: player.id, divisionId } });
  if (existingSpot) {
    await prisma.rosterSpot.update({ where: { id: existingSpot.id }, data: { role, isCaptain: p.isCaptain ?? false } });
  } else {
    await prisma.rosterSpot.create({ data: { teamId, playerId: player.id, divisionId, role, isCaptain: p.isCaptain ?? false } });
  }
  seenSpots.add(`${teamId}:${player.id}`);
}

/** MMR в таблице живёт как «7314.0» — приводим к целому; мусор и нули считаем «не указан». */
const mmrOf = (v: number | string | null | undefined) => {
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

const slugOf = (t: TeamInput) => t.slug?.trim() || slugify(t.name);

/**
 * Дубль команды — всегда ошибка данных, и молча импортировать его нельзя: в БД остаются две карточки
 * одной команды, а игроки уезжают в ту, что залилась последней. Поэтому проверяем ДО записи и падаем.
 * Ловим три случая: один слаг дважды в файле, одна команда под разными слагами (в файле и в БД),
 * и один игрок действующим сразу в двух командах.
 */
async function assertNoDuplicates(teams: TeamInput[]) {
  const errors: string[] = [];

  const bySlug = new Map<string, TeamInput>();
  const byName = new Map<string, string>(); // «имя @ дивизион» → слаг
  for (const t of teams) {
    const slug = slugOf(t);
    if (bySlug.has(slug)) errors.push(`слаг «${slug}» встречается в файле дважды`);
    bySlug.set(slug, t);

    const key = `${t.name.trim().toLowerCase()} @ ${clean(t.group) ?? "—"}`;
    const twin = byName.get(key);
    if (twin && twin !== slug) {
      errors.push(`«${t.name}» в файле дважды — под слагами «${twin}» и «${slug}»; оставьте один`);
    }
    byName.set(key, slug);
  }

  // та же команда, уже лежащая в БД под другим слагом (например, от прошлого прогона с --alias)
  for (const [slug, t] of bySlug) {
    const twins = await prisma.team.findMany({ where: { name: t.name.trim() } });
    for (const tw of twins) {
      if (tw.slug === slug || (tw.group ?? null) !== (clean(t.group) ?? null)) continue;
      errors.push(
        `«${t.name}» уже есть в БД под слагом «${tw.slug}», а импортируется как «${slug}» — будет дубль. ` +
          `Удалите лишнюю команду или задайте slug явно`,
      );
    }
  }

  // Стоять в нескольких составах можно, действующим (поз. 1–5) — только в одной команде ДИВИЗИОНА:
  // внутри дивизиона человек сыграет за одну, иначе стата и составы разъедутся. В разных дивизионах
  // (D1 и D2) действующим быть можно — их турниры раздельны, поэтому ключ проверки: «дивизион + игрок».
  const coreTeam = new Map<string, string>();
  for (const t of teams) {
    const div = clean(t.group) ?? "—";
    for (const p of t.players ?? []) {
      if (!isCoreRole(p.role)) continue;
      // Ключ — человек, а не ник: один и тот же account_id под двумя никами в файле это тот же
      // игрок в двух составах, и поймать его надо здесь, а не после записи.
      const slug = p.slug?.trim() || slugify(p.nickname);
      const key = `${div}::${identityOf(p) ?? slug}`;
      const prev = coreTeam.get(key);
      if (prev) {
        errors.push(
          `игрок «${slug}» действующий и в «${prev}», и в «${slugOf(t)}» (дивизион ${div}) — ` +
            `в одном дивизионе действующим можно быть только в одной команде, во вторую ставьте заменой`,
        );
      } else {
        coreTeam.set(key, slugOf(t));
      }
    }
  }

  if (errors.length) throw new Error(`Конфликты составов — импорт отменён:\n  ${errors.join("\n  ")}`);
}

async function main() {
  const raw = await fs.readFile(file, "utf8").catch(() => {
    throw new Error(`Не найден файл составов: ${file}`);
  });
  const teams = JSON.parse(raw) as TeamInput[];
  if (!Array.isArray(teams)) throw new Error("Ожидался массив команд в корне файла");

  console.log(`Импорт составов${dry ? " (--dry, без записи)" : ""}: ${path.relative(process.cwd(), file)}`);
  await loadIdentities();
  await assertNoDuplicates(teams);
  for (const t of teams) await importTeam(t);

  // Кого убрали из состава в таблице — убираем и из состава в БД. Карточку игрока не трогаем:
  // человек остаётся в базе (со статой и фото), просто больше не числится за этой командой.
  if (!dry) {
    const slugs = teams.map((t) => slugOf(t));
    const spots = await prisma.rosterSpot.findMany({
      where: { team: { slug: { in: slugs } } },
      include: { team: { select: { slug: true } }, player: { select: { slug: true } } },
    });
    for (const s of spots) {
      if (seenSpots.has(`${s.teamId}:${s.playerId}`)) continue;
      await prisma.rosterSpot.delete({ where: { id: s.id } });
      stat.spotsGone++;
      warnings.push(`${s.team.slug}/${s.player.slug}: убран из состава — в таблице его больше нет`);
    }
  }

  console.log(
    `\nКоманды: +${stat.teamsNew} новых, ${stat.teamsUpd} обновлено` +
      `\nИгроки:  +${stat.playersNew} новых, ${stat.playersUpd} обновлено` +
      (stat.spotsGone ? `\nСостав:  -${stat.spotsGone} мест(а) убрано` : ""),
  );
  if (warnings.length) console.log(`\n⚠ ${warnings.length}:\n  ${warnings.join("\n  ")}`);
}

main()
  .catch((e) => {
    console.error(`\n✗ ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
