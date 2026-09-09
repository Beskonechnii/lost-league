// Профили команд и игроков: слаги, пути к загруженным картинкам, внешние ссылки.
// Слаг — стабильный ключ: по нему идёт импорт составов и подбор файлов лого/фото.
// Картинки лежат локально в public/uploads (см. src/lib/assets.ts — та же стратегия для ассетов Dota).

export type UploadKind = "teams" | "players";

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
  э: "e", ю: "yu", я: "ya",
};

/** Название/ник → слаг: латиница, нижний регистр, дефисы. «300$» → "300", кириллица транслитом. */
export function slugify(input: string): string {
  const translit = [...input.toLowerCase()].map((ch) => TRANSLIT[ch] ?? ch).join("");
  return translit
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Тег команды для таблиц и графики. У части команд тега в таблице сезона нет, а колонка должна быть
 * заполнена всегда — поэтому выводим из названия: берём первое слово, латиницу/цифры, до 5 знаков.
 * Это фолбэк: как только тег заведут в ростере, он перекроет вычисленный.
 */
export function teamTag(team: { tag?: string | null; name: string }): string {
  const own = team.tag?.trim();
  if (own) return own;

  const word = team.name.trim().split(/\s+/)[0] ?? team.name;
  const clean = [...word].filter((ch) => /[\p{L}\p{N}]/u.test(ch)).join("");
  return (clean || team.name).slice(0, 5).toUpperCase();
}

/**
 * Акцентный цвет команды. Поле в ростере — истина, но заполнено оно у единиц, а без цвета
 * все карточки и обложки выглядят одинаково. Поэтому цвет по умолчанию выводим из слага:
 * тон стабилен (у команды он всегда один и тот же), насыщенность и светлота фиксированы,
 * чтобы на тёмной теме ничего не выжигало. Как только цвет заведут руками — он перекроет.
 */
export function teamAccent(team: { color?: string | null; slug?: string | null; name?: string }): string {
  const own = team.color?.trim();
  if (own) return own;

  const key = team.slug || team.name || "";
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.codePointAt(0)!) % 360;
  return hslToHex(hash, 0.62, 0.58);
}

/** Цвет команды валиден? Только hex (#rgb/#rrggbb/#rrggbbaa) — он идёт прямо в CSS-стили карточек,
 *  и к нему дописывают альфу суффиксом. Ограничение бережёт от произвольной строки в атрибуте style. */
export const isColor = (raw: string): boolean => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(raw.trim());

/** Всегда возвращаем hex: к нему в разметке дописывают альфу суффиксом («#a855f766»), с hsl() так нельзя. */
function hslToHex(h: number, s: number, l: number): string {
  const c = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${c(0)}${c(8)}${c(4)}`;
}

/** Публичный путь к загруженной картинке профиля. Имя файла хранится в БД целиком. */
export function uploadUrl(kind: UploadKind, file: string): string {
  return `/uploads/${kind}/${file}`;
}

/**
 * account_id игрока «по всему, что о нём известно»: своё поле, иначе выведенное из любой ссылки
 * на профиль. Анкеты приходят из CRM неровно — у части людей заполнена только ссылка на Dotabuff,
 * и матчить их по пустому `accountId` значит терять их статистику на ровном месте.
 *
 * Одно место правды: этим пользуются и распознавание команд на странице матча, и синк статы.
 * Возвращает null, если id взять неоткуда — такого игрока в архиве матча просто не будет.
 */
export function playerAccountId(p: {
  accountId?: string | null;
  dotabuffUrl?: string | null;
  stratzUrl?: string | null;
  steamUrl?: string | null;
}): string | null {
  if (p.accountId?.trim()) return p.accountId.trim();
  for (const url of [p.dotabuffUrl, p.stratzUrl, p.steamUrl]) {
    const id = url ? accountIdFromUrl(url) : null;
    if (id) return id;
  }
  return null;
}

/** Ссылки на внешние профили: считаем из accountId, если в БД не задана своя. */
/**
 * Адрес страницы игрока. Ключ — `slug`: он ставится один раз и навсегда (от него зависят имена
 * файлов картинок), поэтому адрес не разъезжается при смене ника. Числовой id тоже принимается —
 * страница уводит с него на канонический адрес, — но ссылку лучше собирать со слагом.
 *
 * Страница живёт в корне (`/players/<slug>`), а не внутри ростера: профиль — сущность лиги сама по
 * себе, а не строка списка (решение 04.09.2026). Путь относительный — абсолютный собирает тот, кто
 * шлёт ссылку наружу (`siteUrl()` в src/lib/site.ts).
 */
export const playerPath = (player: number | { id: number; slug?: string | null }) =>
  `/players/${typeof player === "number" ? player : player.slug || player.id}`;

export const dotabuffOf = (accountId: string) => `https://www.dotabuff.com/players/${accountId}`;
export const stratzOf = (accountId: string) => `https://stratz.com/players/${accountId}`;
// steam64 = steam32 + константа Valve; 64-битная арифметика — только через BigInt (в Number не влезает).
export const steamOf = (accountId: string) =>
  `https://steamcommunity.com/profiles/${BigInt(accountId) + BigInt("76561197960265728")}`;

const STEAM64_BASE = BigInt("76561197960265728");

/**
 * Ссылка на профиль → Dota account_id (он же steam32). Понимает то, что реально лежит в CRM и
 * приходит от капитанов: steamcommunity.com/profiles/<steam64>, dotabuff/stratz/opendota и просто
 * число (32- или 64-битное).
 *
 * Разбор нарочно терпимый к тому, как ссылку скопировали из браузера: поддомен локали
 * («ru.dotabuff.com»), сегмент локали в пути («stratz.com/ru-ru/players/123»), хвосты вкладок
 * («/matches», «/overview?date=…»), лишние слэши, «@» и пробелы по краям. Позиционно важно только
 * одно: сегмент `players`/`profiles`, за которым идёт число.
 *
 * Именной адрес steamcommunity.com/id/<vanity> не резолвится: имя → steam64 знает только Steam Web API.
 * Такие возвращаем null — в мастере импорта они подсвечиваются оператору как нераспознанные.
 */
export function accountIdFromUrl(raw: string): string | null {
  const s = raw.trim().replace(/^@+/, "");
  if (!s) return null;

  if (/^\d+$/.test(s)) return fromNumeric(s);

  // Отрезаем протокол, query/hash и нормализуем слэши: дальше работаем со строкой «host/путь».
  const path = s
    .replace(/^[a-z]+:\/\//i, "")
    .replace(/[?#].*$/, "")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "");
  if (!path) return null;

  const [hostRaw, ...segments] = path.split("/");
  const host = hostRaw.toLowerCase();
  // Поддомены (www, ru, es, de.dotabuff.com) значения не имеют — важен сам домен.
  const domain = host.split(":")[0].split(".").slice(-2).join(".");
  if (!PROFILE_HOSTS.has(domain)) return null;

  // Сегмент-указатель может стоять не первым: «dotabuff.com/esports/players/1», «stratz.com/ru-ru/players/1».
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i].toLowerCase();
    if (key !== "players" && key !== "profiles" && key !== "player") continue;
    const next = segments[i + 1];
    if (/^\d+$/.test(next)) return fromNumeric(next);
  }
  return null;
}

/** Домены, на которых id игрока лежит прямо в пути. Именно домен, без поддомена локали. */
const PROFILE_HOSTS = new Set(["dotabuff.com", "stratz.com", "opendota.com", "steamcommunity.com"]);

/** steam64 больше 2^53 — сравнение и вычитание только через BigInt, иначе Number всё округлит. */
function fromNumeric(digits: string): string | null {
  const n = BigInt(digits);
  if (n > STEAM64_BASE) return String(n - STEAM64_BASE);
  return n > BigInt(0) ? digits : null;
}

/**
 * Страны, которые реально встречаются в анкетах лиги, с двухбуквенным кодом.
 * Код, а не флаг-эмодзи: Windows рисует флаги как пару букв, и «🇧🇾» выглядел бы как «BY»
 * в одних браузерах и как флаг в других — лучше сразу одинаково везде.
 * Список общий с импортом из CRM (scripts/import-crm.ts), там по нему разбирают «Проживает в».
 */
export const COUNTRIES: Record<string, string> = {
  "Беларусь": "BY", "Россия": "RU", "Украина": "UA", "Казахстан": "KZ", "Польша": "PL",
  "Литва": "LT", "Латвия": "LV", "Эстония": "EE", "Армения": "AM", "Грузия": "GE",
  "Германия": "DE", "Молдова": "MD", "Узбекистан": "UZ", "Кыргызстан": "KG", "Азербайджан": "AZ",
};

/**
 * «Иван Иванов» → имя и фамилия по отдельности.
 *
 * Нужна везде, где человек пишет себя одной строкой: в таблицах ростера колонка одна («Имя»,
 * «ФИО»), в старых карточках то же лежит целиком в `Player.realName`, а модель и анкета держат
 * два поля. Без разбора «Иван Иванов» приезжает в поле «Имя», а «Фамилия» остаётся пустой.
 *
 * Правило простое: первое слово — имя, остальное — фамилия. Отчество (если его написали)
 * приклеится к фамилии — это лучше, чем гадать, где в трёх словах что.
 */
export function splitFullName(raw: string | null | undefined): { realName: string; realSurname: string } {
  const parts = (raw ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { realName: "", realSurname: "" };
  return { realName: parts[0], realSurname: parts.slice(1).join(" ") };
}

/** «Беларусь» → «BY». Незнакомая страна — первые две буквы, чтобы плашка не пустовала. */
export function countryCode(country: string | null | undefined): string | null {
  const name = country?.trim();
  if (!name) return null;
  const known = Object.entries(COUNTRIES).find(([ru]) => ru.toLowerCase() === name.toLowerCase());
  return known ? known[1] : name.slice(0, 2).toUpperCase();
}

/** Хендл телеграма в канонический вид: без «@», без ссылки, без хвостов. Мусор → null. */
export function normalizeTelegram(raw: string): string | null {
  const handle = raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^(?:www\.)?(?:t\.me|telegram\.me|telegram\.dog)\//i, "")
    .replace(/^@/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
  return /^[a-zA-Z0-9_]{4,32}$/.test(handle) ? handle : null;
}

export const telegramUrl = (handle: string) => `https://t.me/${handle.replace(/^@/, "")}`;

/**
 * Дата рождения из строки. Принимаем то, чем её пишут люди и выгрузки CRM:
 * «1998-04-21», «21.04.1998», «21/04/1998». Полдень по UTC — чтобы сдвиг таймзоны
 * не увёл дату на сутки назад при выводе.
 */
export function parseBirthday(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;

  // Ячейка с датой в xlsx приходит числом — дней от 30.12.1899 («36222.0» = 21.03.1999).
  // Порог 10000 (1927 год) отсекает случай, когда в поле написали только год.
  const serial = /^(\d{4,5})(?:\.0+)?$/.exec(s);
  if (serial && Number(serial[1]) >= 10000) {
    return new Date(Date.UTC(1899, 11, 30, 12) + Number(serial[1]) * 86400000);
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const dotted = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/.exec(s);
  const [y, m, d] = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : dotted
      ? [Number(dotted[3]), Number(dotted[2]), Number(dotted[1])]
      : [0, 0, 0];
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;

  const date = new Date(Date.UTC(y, m - 1, d, 12));
  // 31.02 Date молча превратит в 3 марта — ловим это сверкой обратно
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
}

/** Дата рождения к виду «21 апреля 1998» — «г.» в конце тут лишнее. */
export function formatBirthday(date: Date): string {
  const s = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  return s.replace(/\s*г\.$/, "");
}

/** Полных лет на сегодня. Дата рождения хранится как дата, время игнорируем. */
export function ageOf(birthday: Date, now = new Date()): number {
  let age = now.getFullYear() - birthday.getFullYear();
  const passed =
    now.getMonth() > birthday.getMonth() ||
    (now.getMonth() === birthday.getMonth() && now.getDate() >= birthday.getDate());
  if (!passed) age -= 1;
  return age;
}

/** Склонение к числу лет: 21 год, 22 года, 25 лет. */
export function yearsLabel(age: number): string {
  const t = age % 100;
  if (t >= 11 && t <= 14) return `${age} лет`;
  const u = age % 10;
  if (u === 1) return `${age} год`;
  if (u >= 2 && u <= 4) return `${age} года`;
  return `${age} лет`;
}

/**
 * Чего не хватает в карточке игрока. Один список на список игроков и на профиль,
 * чтобы «12 без анкеты» в шапке и подпись под ником не разъезжались.
 *
 * Фото сюда не входит намеренно: его отсутствие и так видно — вместо портрета
 * стоят инициалы, — а приписка «нет фото» у всех 95 карточек превратила бы
 * подсказку в шум. Портреты заливаются отдельным потоком (scripts/import-media.ts).
 */
export function playerGaps(p: {
  accountId?: string | null;
  dotabuffUrl?: string | null;
  stratzUrl?: string | null;
  steamUrl?: string | null;
  realName?: string | null;
  birthday?: Date | null;
  city?: string | null;
  country?: string | null;
  telegram?: string | null;
}): string[] {
  return [
    // Дырка — это когда id не выводится ВООБЩЕ ниоткуда. Пустое поле при живой ссылке на профиль
    // дыркой не считается: id из неё разбирается на лету (`playerAccountId`), и матчи такого
    // игрока находятся. Иначе витрина ругалась на игроков, у которых всё в порядке.
    !playerAccountId(p) && "account_id",
    !p.realName && "имя",
    !p.birthday && "дата рождения",
    // в CRM часто указана только страна — считаем, что место жительства всё-таки есть
    !p.city && !p.country && "город",
    !p.telegram && "телеграм",
  ].filter((x): x is string => typeof x === "string");
}

type PlayerLinksInput = {
  accountId?: string | null;
  steamUrl?: string | null;
  dotabuffUrl?: string | null;
  stratzUrl?: string | null;
};

/** Итоговые ссылки игрока: поля из БД перекрывают вывод из accountId. */
export function playerLinks(p: PlayerLinksInput) {
  const id = p.accountId?.trim();
  const derived = id && /^\d+$/.test(id);
  return {
    steam: p.steamUrl ?? (derived ? steamOf(id) : null),
    dotabuff: p.dotabuffUrl ?? (derived ? dotabuffOf(id) : null),
    stratz: p.stratzUrl ?? (derived ? stratzOf(id) : null),
  };
}
