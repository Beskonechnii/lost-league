// Анкета-заявка на вступление в лигу — чистый модуль (без БД и next/headers), как permissions.ts:
// по нему рисуется форма в кабинете, им же валидируются данные в server-action, и из него же
// на этапе апрува соберётся Player.
//
// Почему анкета живёт JSON'ом на UserAccount, а не сразу заводит Player: публичные витрины
// (/roster/players, статистика, драфт) читают Player без фильтров, и неодобренный человек попал бы
// в ростер в момент регистрации (docs/archive/ACCOUNTS-PLAN.md §2.1).
//
// Ссылка — ОДНА на анкету: Dotabuff, Stratz или Steam на выбор. Из неё выводится account_id, а из
// него — два остальных адреса (`playerLinks`), поэтому три поля были тремя способами сказать одно.
// Какая площадка досталась, видно по хосту — оператору этого хватает.

import { parseBirthday, normalizeTelegram, playerAccountId } from "./profiles";
import { isRole } from "./roles";

export type Application = {
  nickname: string;
  realName: string;
  realSurname: string;
  birthday: string; // yyyy-mm-dd — уже нормализованная, как её понимает <input type=date>
  city: string;
  country: string;
  /** Любая из трёх площадок; остальные лига достроит сама по account_id. */
  profileUrl: string;
  telegram: string; // хендл без «@» (как в Player.telegram)
  phone: string;
  position: string; // ключ из roles.ts либо пусто
  mmr: number | null; // ЗАЯВЛЕННЫЙ игроком; в Player.mmr его переносит оператор при апруве
};

/** Пустая анкета — начальное состояние формы. */
export const EMPTY_APPLICATION: Application = {
  nickname: "",
  realName: "",
  realSurname: "",
  birthday: "",
  city: "",
  country: "",
  profileUrl: "",
  telegram: "",
  phone: "",
  position: "",
  mmr: null,
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
    // Ключи старых анкет (три ссылки) в тип уже не входят — читаем как есть, поэтому Record.
    const data = JSON.parse(raw) as Partial<Application> & Record<string, unknown>;
    const text = (v: unknown) => (typeof v === "string" ? v : "");
    return {
      ...EMPTY_APPLICATION,
      nickname: text(data.nickname),
      realName: text(data.realName),
      realSurname: text(data.realSurname),
      birthday: text(data.birthday),
      city: text(data.city),
      country: text(data.country),
      // Старые анкеты в БД держат три отдельных поля — берём первое заполненное.
      profileUrl: text(data.profileUrl) || text(data.dotabuff) || text(data.stratz) || text(data.steam),
      telegram: text(data.telegram),
      phone: text(data.phone),
      position: text(data.position),
      mmr: typeof data.mmr === "number" ? data.mmr : null,
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

/** Какой площадке принадлежит ссылка. Не разобралась или чужой хост → null. */
export function profileLinkKind(raw: string): keyof typeof LINK_HOSTS | null {
  const value = raw.trim();
  if (!value) return null;
  let host: string;
  try {
    host = new URL(value.startsWith("http") ? value : `https://${value}`).hostname;
  } catch {
    return null;
  }
  for (const kind of ["dotabuff", "stratz", "steam"] as const) {
    if (LINK_HOSTS[kind].re.test(host)) return kind;
  }
  return null;
}

/** Одна ссылка на профиль — годится любая из трёх площадок. Пусто → null (обязательность отдельно). */
export function anyProfileLinkProblem(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  return profileLinkKind(value)
    ? null
    : "Ждём ссылку на Dotabuff, Stratz или Steam — например https://www.dotabuff.com/players/123456";
}

/** Ссылка на профиль конкретной площадки: пусто → null, мусор → текст ошибки. */
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

/** Телефон → цифры с ведущим «+», если он был. Мусор (буквы, слишком короткая строка) → пусто. */
function normalizePhone(raw: string): string {
  const value = raw.trim();
  const plus = value.startsWith("+") ? "+" : "";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return "";
  return plus + digits;
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

  const realSurname = input.realSurname.trim();
  if (!realSurname) return { ok: false, error: "Укажите фамилию" };

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

  if (!input.phone.trim()) return { ok: false, error: "Укажите телефон" };
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, error: `«${input.phone.trim()}» не похоже на номер телефона` };

  // Ссылка обязательна: по ней оператор опознаёт человека, а без account_id игрок потом
  // не находится ни в одном матче (см. §7 CLAUDE.md).
  if (!input.profileUrl.trim()) {
    return { ok: false, error: "Дайте ссылку на свой профиль: Dotabuff, Stratz или Steam" };
  }
  const linkProblem = anyProfileLinkProblem(input.profileUrl);
  if (linkProblem) return { ok: false, error: linkProblem };
  const profileUrl = normalizeLink(input.profileUrl);

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
      realSurname,
      birthday,
      city,
      country,
      profileUrl,
      telegram,
      phone,
      position,
      mmr,
    },
  };
}

/** account_id из ссылки анкеты — им апрув свяжет человека с его матчами. Не вывелся → null. */
export const applicationAccountId = (app: Application): string | null =>
  playerAccountId({
    dotabuffUrl: profileLinkKind(app.profileUrl) === "dotabuff" ? app.profileUrl : null,
    stratzUrl: profileLinkKind(app.profileUrl) === "stratz" ? app.profileUrl : null,
    steamUrl: profileLinkKind(app.profileUrl) === "steam" ? app.profileUrl : null,
  });

/** Ссылка анкеты → колонка Player, в которую её класть. */
export const applicationLinkColumns = (app: Application) => ({
  dotabuffUrl: profileLinkKind(app.profileUrl) === "dotabuff" ? app.profileUrl : null,
  stratzUrl: profileLinkKind(app.profileUrl) === "stratz" ? app.profileUrl : null,
  steamUrl: profileLinkKind(app.profileUrl) === "steam" ? app.profileUrl : null,
});
