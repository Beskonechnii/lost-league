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

import { accountIdFromUrl, parseBirthday, normalizeTelegram, playerAccountId } from "./profiles";
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

// ── черновик анкеты ───────────────────────────────────────────────────────────
//
// Отдельное поле (`UserAccount.applicationDraft`), а не `application`: там лежит прошедший
// normalizeApplication результат, а черновик по определению невалиден — незаконченный ввод.
// Пишется на каждом переходе вперёд по шагу квиза, чистится при отправке.

/** Незаконченный квиз: что уже введено, на каком шаге остановились и на чём это восстановить. */
export type ApplicationDraft = {
  values: ApplicationInput;
  step: number;
  /** Ветка «я уже участник лиги»: найденный в ростере игрок — иначе поиск себя проходится заново. */
  playerId: number | null;
  /** Отметка «принимаю правила». Без неё возврат сразу на шаг 3 упирался бы в отказ сервера. */
  policy: boolean;
};

/** Черновик → строка для БД. */
export const formatDraft = (draft: ApplicationDraft): string => JSON.stringify(draft);

// Набор полей анкеты со временем меняется. Черновик со старым набором не «дочитываем» по ключу,
// а выбрасываем целиком: половина ответов от прошлой версии формы путает сильнее, чем пустой квиз.
const INPUT_KEYS = Object.keys(EMPTY_INPUT).sort();

/** JSON из БД → черновик. Мусор и чужой набор полей → null: черновик не имеет права ронять форму. */
export function parseDraft(raw: string | null | undefined): ApplicationDraft | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== "object") return null;

    const values = data.values;
    if (!values || typeof values !== "object" || Array.isArray(values)) return null;
    const keys = Object.keys(values).sort();
    if (keys.length !== INPUT_KEYS.length || keys.some((k, i) => k !== INPUT_KEYS[i])) return null;
    if (Object.values(values).some((v) => typeof v !== "string")) return null;

    const step = typeof data.step === "number" && Number.isInteger(data.step) && data.step >= 0 ? data.step : 0;
    const playerId =
      typeof data.playerId === "number" && Number.isInteger(data.playerId) && data.playerId > 0 ? data.playerId : null;

    return { values: values as ApplicationInput, step, playerId, policy: data.policy === true };
  } catch {
    return null;
  }
}

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

/**
 * Претензия к ссылке на профиль, либо null. Одно место правды на форму, бота и сервер:
 * анкета показывает этот текст у самого поля, поэтому разъехаться правилам негде.
 *
 * Мало правильного хоста — из ссылки обязан выводиться account_id: без него человек потом
 * не находится ни в одном матче лиги, а оператор узнаёт об этом уже после апрува. Пример в
 * тексте намеренно без `https://` и `www` — с ними плашка на 390 уходит в три строки.
 */
export function anyProfileLinkProblem(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Нужна ссылка на профиль: Dotabuff, Stratz или Steam";
  const kind = profileLinkKind(value);
  if (!kind) return "Нужна ссылка на Dotabuff, Stratz или Steam — например dotabuff.com/players/123456";
  if (accountIdFromUrl(value)) return null;
  // Именной адрес Steam в id не превращается: имя → steam64 знает только Steam Web API.
  if (kind === "steam") {
    return "Именную ссылку Steam мы не разбираем — возьмите адрес с числом (/profiles/7656…) или ссылку Dotabuff";
  }
  return "В ссылке нет номера профиля — нужен адрес вида dotabuff.com/players/123456";
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

/** Адрес претензии: поле анкеты либо флажок согласия (он не поле ввода, но отвергает отправку). */
export type ApplicationField = keyof ApplicationInput | "policy";

/** Что не так с каждым полем. Пусто — анкета годится. */
export type ApplicationProblems = Partial<Record<ApplicationField, string>>;

export type ApplicationResult =
  | { ok: true; value: Application }
  | { ok: false; error: string; field: ApplicationField };

// Заявленный MMR — со слов игрока, но верхняя граница нужна: без неё в очередь модерации приезжают
// «99999», и оператору приходится гадать, опечатка это или шутка.
export const MMR_MAX = 15000;

/** Отказ без согласия с правилами. Текст здесь, а не в account.ts: форма показывает тот же. */
export const POLICY_PROBLEM = "Без согласия заявку не отправить — отметьте флажок";

/** «Другая» страна выбрана, а строка пустая — случай виден только форме, текст живёт здесь. */
export const COUNTRY_OTHER_PROBLEM = "Впишите страну";

/** Порядок полей в форме: им же выбирается, о чём сказать первым и куда увести фокус. */
export const APPLICATION_FIELDS: ApplicationField[] = [
  "nickname",
  "realName",
  "realSurname",
  "birthday",
  "city",
  "country",
  "telegram",
  "phone",
  "policy",
  "profileUrl",
  "mmr",
  "position",
];

/**
 * Претензии ко всем полям сразу — один словарь на форму и на сервер.
 *
 * Зачем словарём, а не «первой ошибкой»: форма обязана подсветить ВСЕ незаполненные поля шага
 * разом, иначе человек чинит их по одному, каждый раз упираясь в ту же кнопку. Сервер из этого
 * же словаря берёт первую претензию по порядку формы — ему хватает одной.
 *
 * Тексты называют, что нужно сделать, а не что неверно, и не кавычат введённое: оно стоит в поле
 * прямо над плашкой.
 */
export function applicationProblems(input: ApplicationInput, policyAccepted = true): ApplicationProblems {
  const p: ApplicationProblems = {};

  if (!input.nickname.trim()) p.nickname = "Впишите ник — под ним вас увидят в таблицах";

  // Анкета уходит на модерацию только заполненной целиком: оператор решает по ней одну,
  // и добирать недостающее перепиской — та же работа, что вернуть заявку.
  if (!input.realName.trim()) p.realName = "Впишите имя";
  if (!input.realSurname.trim()) p.realSurname = "Впишите фамилию";

  if (!input.birthday.trim()) p.birthday = "Укажите дату рождения";
  else if (!parseBirthday(input.birthday)) p.birthday = "Дата вида 21.04.1998";

  if (!input.city.trim()) p.city = "Впишите город";
  if (!input.country.trim()) p.country = "Выберите страну";

  if (!input.telegram.trim()) p.telegram = "Впишите телеграм — по нему с вами свяжется организатор";
  else if (!normalizeTelegram(input.telegram)) p.telegram = "Ждём @nickname или ссылку t.me";

  // Телефон — единственное необязательное поле анкеты: связываться организатор всё равно будет
  // телеграмом, а обязательный номер отсекал тех, кто его не даёт. Написали — проверяем.
  if (input.phone.trim() && !normalizePhone(input.phone)) {
    p.phone = "Ждём номер с кодом страны: +7 900 000-00-00";
  }

  if (!policyAccepted) p.policy = POLICY_PROBLEM;

  // Ссылка обязательна: по ней оператор опознаёт человека, а без account_id игрок потом
  // не находится ни в одном матче (см. §7 CLAUDE.md).
  const link = anyProfileLinkProblem(input.profileUrl);
  if (link) p.profileUrl = link;

  if (!input.mmr.trim()) p.mmr = "Впишите MMR — числом";
  else {
    const n = Number(input.mmr.replace(/\s+/g, ""));
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) p.mmr = "Только цифры, без букв и пробелов";
    else if (n > MMR_MAX) p.mmr = "Столько MMR не бывает — проверьте число";
  }

  if (!isRole(input.position.trim())) p.position = "Выберите позицию";

  return p;
}

/** Значения формы → проверенная анкета. Одно место правды: зовёт и server-action, и (позже) апрув. */
export function normalizeApplication(input: ApplicationInput): ApplicationResult {
  const problems = applicationProblems(input);
  const field = APPLICATION_FIELDS.find((f) => problems[f]);
  if (field) return { ok: false, error: problems[field]!, field };

  return {
    ok: true,
    value: {
      nickname: input.nickname.trim(),
      realName: input.realName.trim(),
      realSurname: input.realSurname.trim(),
      birthday: parseBirthday(input.birthday)!.toISOString().slice(0, 10),
      city: input.city.trim(),
      country: input.country.trim(),
      profileUrl: normalizeLink(input.profileUrl),
      telegram: normalizeTelegram(input.telegram)!,
      phone: input.phone.trim() ? normalizePhone(input.phone) : "",
      position: input.position.trim(),
      mmr: Number(input.mmr.replace(/\s+/g, "")),
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
