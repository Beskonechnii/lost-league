// Анкета-заявка на вступление в лигу — чистый модуль (без БД и next/headers), как permissions.ts:
// по нему рисуется форма в кабинете, им же валидируются данные в server-action, и из него же
// на этапе апрува соберётся Player.
//
// Почему анкета живёт JSON'ом на UserAccount, а не сразу заводит Player: публичные витрины
// (/roster/players, статистика, драфт) читают Player без фильтров, и неодобренный человек попал бы
// в ростер в момент регистрации (docs/archive/ACCOUNTS-PLAN.md §2.1).
//
// Ссылки — каждая отдельным полем (требование 6): в общем поле «ссылка на профиль» человек присылал
// что угодно, а оператору при проверке нужно видеть, что именно он дал — Dotabuff, Stratz или Steam.

import { parseBirthday, normalizeTelegram, playerAccountId } from "./profiles";
import { isRole } from "./roles";

export type Application = {
  nickname: string;
  realName: string;
  birthday: string; // yyyy-mm-dd — уже нормализованная, как её понимает <input type=date>
  city: string;
  country: string;
  dotabuff: string;
  stratz: string;
  steam: string;
  telegram: string; // хендл без «@» (как в Player.telegram)
  position: string; // ключ из roles.ts либо пусто
  mmr: number | null; // ЗАЯВЛЕННЫЙ игроком; в Player.mmr его переносит оператор при апруве
  achievements: string;
};

/** Пустая анкета — начальное состояние формы. */
export const EMPTY_APPLICATION: Application = {
  nickname: "",
  realName: "",
  birthday: "",
  city: "",
  country: "",
  dotabuff: "",
  stratz: "",
  steam: "",
  telegram: "",
  position: "",
  mmr: null,
  achievements: "",
};

/** Сырые значения формы: те же ключи, но всё строками (FormData другого не отдаёт). */
export type ApplicationInput = Record<keyof Application, string>;

/** Анкета → значения формы. Нужно, чтобы после ошибки вернуть в поля то, что человек ввёл:
 *  React после submit сбрасывает неуправляемые поля к defaultValue, и без этого длинная анкета
 *  очищалась бы на каждой опечатке. */
export const applicationToInput = (app: Application): ApplicationInput => ({
  ...app,
  mmr: app.mmr == null ? "" : String(app.mmr),
});

export const EMPTY_INPUT: ApplicationInput = applicationToInput(EMPTY_APPLICATION);

/** JSON из БД → анкета. Битую строку считаем «анкеты нет»: заявка всё равно на модерации. */
export function parseApplication(raw: string | null | undefined): Application | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<Application>;
    const text = (v: unknown) => (typeof v === "string" ? v : "");
    return {
      ...EMPTY_APPLICATION,
      nickname: text(data.nickname),
      realName: text(data.realName),
      birthday: text(data.birthday),
      city: text(data.city),
      country: text(data.country),
      dotabuff: text(data.dotabuff),
      stratz: text(data.stratz),
      steam: text(data.steam),
      telegram: text(data.telegram),
      position: text(data.position),
      mmr: typeof data.mmr === "number" ? data.mmr : null,
      achievements: text(data.achievements),
    };
  } catch {
    return null;
  }
}

/** Анкета → строка для БД. */
export const formatApplication = (app: Application): string => JSON.stringify(app);

// Хосты, которые ждём в каждом поле ссылки. Проверяем именно хост, а не «разбирается ли в id»:
// именной адрес Steam (steamcommunity.com/id/<имя>) в id не превращается, но оператору он полезен.
const LINK_HOSTS: Record<"dotabuff" | "stratz" | "steam", { re: RegExp; label: string; example: string }> = {
  dotabuff: { re: /(^|\.)dotabuff\.com$/i, label: "Dotabuff", example: "https://www.dotabuff.com/players/123456" },
  stratz: { re: /(^|\.)stratz\.com$/i, label: "Stratz", example: "https://stratz.com/players/123456" },
  steam: { re: /(^|\.)steamcommunity\.com$/i, label: "Steam", example: "https://steamcommunity.com/profiles/7656119…" },
};

/** Ссылка на профиль: пусто → null, мусор → текст ошибки. Возвращает претензию либо null. */
export function profileLinkProblem(kind: keyof typeof LINK_HOSTS, raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const { re, label, example } = LINK_HOSTS[kind];
  let host: string;
  try {
    host = new URL(value.startsWith("http") ? value : `https://${value}`).hostname;
  } catch {
    return `Ссылка ${label} не разобрана. Ждём вид ${example}`;
  }
  return re.test(host) ? null : `В поле ${label} ждём ссылку на ${label.toLowerCase()}: ${example}`;
}

/** Ссылку приводим к единому виду: со схемой и без хвостовых слэшей — так её потом класть в Player. */
const normalizeLink = (raw: string): string => {
  const value = raw.trim().replace(/\/+$/, "");
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

export type ApplicationResult = { ok: true; value: Application } | { ok: false; error: string };

// Заявленный MMR — со слов игрока, но верхняя граница нужна: без неё в очередь модерации приезжают
// «99999», и оператору приходится гадать, опечатка это или шутка.
export const MMR_MAX = 15000;

/** Значения формы → проверенная анкета. Одно место правды: зовёт и server-action, и (позже) апрув. */
export function normalizeApplication(input: ApplicationInput): ApplicationResult {
  const nickname = input.nickname.trim();
  if (!nickname) return { ok: false, error: "Укажите ник — под ним вас увидят в лиге" };

  // Анкета уходит на модерацию только заполненной целиком: оператор решает по ней одну,
  // и добирать недостающее перепиской — та же работа, что вернуть заявку.
  const realName = input.realName.trim();
  if (!realName) return { ok: false, error: "Укажите имя" };

  if (!input.birthday.trim()) return { ok: false, error: "Укажите дату рождения" };
  const date = parseBirthday(input.birthday);
  if (!date) return { ok: false, error: `Дата «${input.birthday.trim()}» не разобрана — ждём 21.04.1998` };
  const birthday = date.toISOString().slice(0, 10);

  const city = input.city.trim();
  if (!city) return { ok: false, error: "Укажите город" };

  const country = input.country.trim();
  if (!country) return { ok: false, error: "Укажите страну" };

  if (!input.telegram.trim()) return { ok: false, error: "Укажите телеграм — по нему с вами свяжется организатор" };
  const telegram = normalizeTelegram(input.telegram);
  if (!telegram) return { ok: false, error: `«${input.telegram.trim()}» не похоже на телеграм-хендл` };

  for (const kind of ["dotabuff", "stratz", "steam"] as const) {
    const problem = profileLinkProblem(kind, input[kind]);
    if (problem) return { ok: false, error: problem };
  }
  const dotabuff = normalizeLink(input.dotabuff);
  const stratz = normalizeLink(input.stratz);
  const steam = normalizeLink(input.steam);
  // Хотя бы одна ссылка обязательна: по ней оператор опознаёт человека, а без account_id игрок
  // потом не находится ни в одном матче (см. §7 CLAUDE.md). Все три требовать нельзя — у части
  // игроков есть не каждый профиль.
  if (!dotabuff && !stratz && !steam) {
    return { ok: false, error: "Дайте хотя бы одну ссылку на профиль: Dotabuff, Stratz или Steam" };
  }

  const position = input.position.trim();
  if (!position) return { ok: false, error: "Выберите позицию" };
  if (!isRole(position)) return { ok: false, error: "Выберите позицию из списка" };

  if (!input.mmr.trim()) return { ok: false, error: "Укажите MMR — заявленный, его проверит организатор" };
  const n = Number(input.mmr.replace(/\s+/g, ""));
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > MMR_MAX) {
    return { ok: false, error: `MMR — целое число от 0 до ${MMR_MAX}` };
  }
  const mmr = n;

  return {
    ok: true,
    value: {
      nickname,
      realName,
      birthday,
      city,
      country,
      dotabuff,
      stratz,
      steam,
      telegram,
      position,
      mmr,
      // Достижения — единственное необязательное поле: у новичка их просто нет.
      achievements: input.achievements.trim(),
    },
  };
}

/** account_id из ссылок анкеты — им апрув свяжет человека с его матчами. Не вывелся → null. */
export const applicationAccountId = (app: Application): string | null =>
  playerAccountId({ dotabuffUrl: app.dotabuff, stratzUrl: app.stratz, steamUrl: app.steam });
