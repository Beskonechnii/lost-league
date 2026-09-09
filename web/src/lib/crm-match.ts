// Свод разобранной выгрузки CRM (crm-import.ts) с ростером: кто из строк — уже известный игрок,
// что именно у него изменится. Отдельно от разбора, потому что здесь есть prisma (тот же раздел,
// что и у team-application.ts: разбор — чистый модуль, запись — модуль с БД).
//
// Обогащение, а не запись вслепую: своё поле не затираем (в базе оно может быть точнее CRM),
// пустое — заполняем. Показываем оператору предложенные правки ДО записи — он решает, какие
// строки принять, тем же флажком, что и в мастере импорта составов.

import { prisma } from "./prisma";
import { COUNTRIES, accountIdFromUrl, normalizeTelegram, parseBirthday, slugify, splitFullName } from "./profiles";
import type { CrmRow } from "./crm-import";

export type CrmFieldKey = "accountId" | "realName" | "realSurname" | "city" | "country" | "telegram" | "birthday" | "steamUrl";

export type CrmChange = { key: CrmFieldKey; label: string; from: string | null; to: string };

export type CrmMatch = {
  nickname: string; // ник из строки CRM
  playerId: number;
  playerSlug: string;
  playerNickname: string; // текущий ник в базе — может отличаться от CRM
  changes: CrmChange[];
  problems: string[];
};

export type CrmMatchResult = {
  matches: CrmMatch[]; // только те, у кого нашлось хоть одно поле для записи
  unchanged: number; // найден, но обновлять нечего
  unmatched: string[]; // ника нет в базе — другой дивизион или прошлый сезон
};

const LABELS: Record<CrmFieldKey, string> = {
  accountId: "account_id",
  realName: "имя",
  realSurname: "фамилия",
  city: "город",
  country: "страна",
  telegram: "телеграм",
  birthday: "дата рождения",
  steamUrl: "ссылка Steam",
};

// В CRM одна колонка «Проживает в», и пишут в неё что угодно: «Минск», «Беларусь», «Россия, Пермь».
// Разводим по нашим двум полям по списку стран — угадывать по любому слову было бы хуже, чем не угадывать.
function splitPlace(raw: string): { city: string | null; country: string | null } {
  const names = Object.keys(COUNTRIES);
  const parts = raw.split(/\s*,\s*/).filter(Boolean);
  const country = parts.find((p) => names.some((c) => c.toLowerCase() === p.toLowerCase())) ?? null;
  const city = parts.find((p) => p !== country) ?? null;
  return { city, country };
}

/** Дата рождения, в которую можно поверить: не будущее, не позапрошлый век, игроку не меньше 10 лет. */
function plausibleBirthday(date: Date): boolean {
  const year = date.getUTCFullYear();
  return year >= 1950 && year <= new Date().getFullYear() - 10;
}

/**
 * Свести строки CRM с базой. `force` — перезаписывать уже заполненные поля (по умолчанию трогаем
 * только пустые: своё не затираем чужой выгрузкой).
 */
export async function matchCrmRows(rows: CrmRow[], opts: { force?: boolean } = {}): Promise<CrmMatchResult> {
  const force = opts.force ?? false;
  const players = await prisma.player.findMany();
  const byAccount = new Map(players.filter((p) => p.accountId).map((p) => [p.accountId!, p]));
  const bySlug = new Map(players.map((p) => [p.slug, p]));
  const byNick = new Map(players.map((p) => [p.nickname.toLowerCase(), p]));

  const matches: CrmMatch[] = [];
  const unmatched: string[] = [];
  let unchanged = 0;

  for (const row of rows) {
    const nickname = row.nickname!.trim();
    // account_id из выгрузки: колонкой или любой из ссылок на профиль (steam64 свернётся в steam32).
    const ids = new Set(
      [row.accountId ?? "", ...row.links].map(accountIdFromUrl).filter((x): x is string => Boolean(x)),
    );
    const problems: string[] = [];
    if (ids.size > 1) problems.push(`ссылки дают разные id (${[...ids].join(", ")}) — account_id не трогаю`);
    const accountId = ids.size === 1 ? [...ids][0] : null;

    const player =
      (accountId ? byAccount.get(accountId) : undefined) ??
      bySlug.get(slugify(nickname)) ??
      byNick.get(nickname.toLowerCase());
    if (!player) {
      unmatched.push(nickname);
      continue;
    }

    const changes: CrmChange[] = [];
    const put = (key: CrmFieldKey, value: string | null, current: string | null) => {
      if (value === null || value === undefined || value === "") return;
      if (current && !force) return; // своё не затираем: в базе данные свежее, чем в CRM
      if (current === value) return;
      changes.push({ key, label: LABELS[key], from: current, to: value });
    };

    // Имя и фамилия у нас тоже два поля, но колонка «Фамилия» в выгрузке бывает не всегда:
    // без неё в «Имя» приходит «Иван Иванов» целиком — тогда разбираем строку сами.
    const name = row.lastName?.trim()
      ? { realName: row.realName?.trim() ?? "", realSurname: row.lastName.trim() }
      : splitFullName(row.realName);
    const place = splitPlace(row.city?.trim() ?? "");

    put("accountId", accountId, player.accountId);
    put("realName", name.realName || null, player.realName);
    put("realSurname", name.realSurname || null, player.realSurname);
    put("city", place.city, player.city);
    put("country", row.country?.trim() || place.country, player.country);

    if (row.telegram?.trim()) {
      const handle = normalizeTelegram(row.telegram);
      if (handle) put("telegram", handle, player.telegram);
      else problems.push(`телеграм «${row.telegram.trim()}» не разобран`);
    }
    if (row.birthday?.trim()) {
      const date = parseBirthday(row.birthday);
      if (date && plausibleBirthday(date)) put("birthday", date.toISOString(), player.birthday?.toISOString() ?? null);
      else if (date) problems.push(`дата ${date.toISOString().slice(0, 10)} — похоже на опечатку в CRM, не пишу`);
      else problems.push(`дата «${row.birthday.trim()}» не разобрана`);
    }
    // Именную ссылку (/id/<vanity>) развернуть нечем — сохраняем как есть, чтобы можно было
    // открыть её руками и достать id.
    const vanity = row.links.find((l) => /steamcommunity\.com\/id\//i.test(l));
    if (!accountId && vanity) {
      put("steamUrl", vanity, player.steamUrl);
      problems.push(`именная ссылка ${vanity} — account_id из неё не достать`);
    }

    if (changes.length === 0) {
      unchanged++;
      continue;
    }
    matches.push({
      nickname,
      playerId: player.id,
      playerSlug: player.slug,
      playerNickname: player.nickname,
      changes,
      problems,
    });
  }

  return { matches, unchanged, unmatched };
}

/** Записать выбранные оператором строки. Возвращает, сколько игроков и полей затронуто. */
export async function applyCrmChanges(matches: CrmMatch[], picked: Set<number>): Promise<{ updated: number; fields: number }> {
  let updated = 0;
  let fields = 0;
  for (const m of matches) {
    if (!picked.has(m.playerId) || m.changes.length === 0) continue;
    const data: Record<string, unknown> = {};
    for (const c of m.changes) data[c.key] = c.key === "birthday" ? new Date(c.to) : c.to;
    await prisma.player.update({ where: { id: m.playerId }, data });
    updated++;
    fields += m.changes.length;
  }
  return { updated, fields };
}
