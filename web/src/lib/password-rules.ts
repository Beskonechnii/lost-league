// Требования к паролю и шкала силы. Чистый модуль — годится и на клиенте (как dota-rank.ts).
//
// Почему отдельно от password.ts: там `node:crypto`, и импорт этого файла в форму утащил бы
// в браузерный бандл всю крипту (а Turbopack на такой импорт просто ругнётся). Здесь ни сети,
// ни крипты — одни константы и строки, поэтому одни и те же правила зовёт и форма (шкала под
// полем), и сервер (отказ). Одно место правды: разъехаться подсказке и проверке негде.
//
// Чего здесь намеренно НЕТ — обязательных классов символов («минимум одна заглавная и цифра»).
// NIST 800-63B от них отговаривает: ответ пользователя на такое требование — `Password1!`,
// который перебирается быстрее длинной фразы из трёх слов. Работают длина, чёрный список
// и лимит попыток входа (lib/rate-limit.ts).

import { PASSWORD_BLOCKLIST } from "./password-blocklist";

/** Минимальная длина пароля. Число в текстах не писать руками — подставлять эту константу. */
export const PASSWORD_MIN = 10;

/** Верхняя граница: длиннее незачем, а scrypt на мегабайтном вводе — способ занять процессор. */
const PASSWORD_MAX = 200;

/** То, чем пароль не должен быть: почта и ник владельца — первое, что подставит знакомый. */
export type PasswordContext = { email?: string; nickname?: string };

const BLOCKED = new Set(PASSWORD_BLOCKLIST);

/** Совпадение с личным считаем от 4 символов: ник «Ян» внутри пароля — совпадение случайное. */
const PERSONAL_MIN = 4;

/**
 * «Основа» пароля — без хвоста из цифр и знаков препинания.
 *
 * Нужна потому, что чёрный список из коротких слов сам по себе почти бесполезен при минимуме
 * в 10 символов: `qwerty` до проверки не доживёт, а `qwerty123456` доживёт и по строгому
 * равенству не найдётся. Дописать цифр в конец — ровно то, как «усложняют» пароль на практике.
 */
function stem(lower: string): string {
  return lower.replace(/[\d!@#$%^&*_.\-+=~]+$/, "");
}

/** Есть ли пароль (или его основа) в чёрном списке. Сравнение по нижнему регистру. */
function isBlocked(lower: string): boolean {
  if (BLOCKED.has(lower)) return true;
  const base = stem(lower);
  return base.length >= PERSONAL_MIN && BLOCKED.has(base);
}

/** Пересекается ли пароль с личными данными: одно содержит другое, регистр не важен. */
function repeatsPersonal(lower: string, ctx: PasswordContext | undefined): boolean {
  const parts = [
    // Из почты берём только локальную часть: домен (`gmail.com`) есть у половины лиги
    // и запрещать его внутри пароля не за что.
    ctx?.email?.split("@")[0],
    ctx?.nickname,
  ];
  return parts.some((raw) => {
    const part = raw?.trim().toLowerCase();
    if (!part || part.length < PERSONAL_MIN) return false;
    return lower.includes(part) || part.includes(lower);
  });
}

/**
 * Претензия к паролю или null. Одно место правды: зовут и форма, и сервер.
 *
 * Применяется при ЗАВЕДЕНИИ и СМЕНЕ пароля, но не при проверке на входе: у части аккаунтов
 * пароли заведены по старым правилам (минимум был 8), и ужесточение не должно запирать людей
 * снаружи. Перехешировать или гнать всех на смену — отдельная задача, не эта.
 */
export function passwordProblem(password: string, ctx?: PasswordContext): string | null {
  if (password.length < PASSWORD_MIN) return `Пароль должен быть не короче ${PASSWORD_MIN} символов`;
  if (password.length > PASSWORD_MAX) return "Слишком длинный пароль";

  const lower = password.toLowerCase();
  if (isBlocked(lower)) return "Такой пароль слишком часто встречается — придумайте другой";
  if (repeatsPersonal(lower, ctx)) return "Пароль не должен повторять почту или ник";

  return null;
}

const LABELS = ["Слишком простой", "Слабый", "Средний", "Хороший", "Надёжный"] as const;

export type PasswordScore = 0 | 1 | 2 | 3 | 4;

/**
 * 0–4 для шкалы под полем. Чистая функция, без сети и без крипты.
 *
 * Считаем длину и разнообразие символов, а не «энтропию»: честная оценка стойкости требует
 * словаря на мегабайты, а шкала здесь — подсказка «дописать ещё пару слов», а не приговор.
 * Всё, что сервер отвергнет (`passwordProblem`), получает 0 — шкала не имеет права хвалить
 * пароль, который не пройдёт отправку.
 */
export function passwordStrength(
  password: string,
  ctx?: PasswordContext,
): { score: PasswordScore; label: string } {
  if (passwordProblem(password, ctx)) return { score: 0, label: LABELS[0] };

  const classes =
    Number(/[a-zа-яё]/.test(password)) +
    Number(/[A-ZА-ЯЁ]/.test(password)) +
    Number(/\d/.test(password)) +
    Number(/[^\dA-Za-zА-Яа-яЁё]/.test(password));

  // Разнообразие добавляет, но не заменяет длину: `Aa1!` короче и слабее, чем три слова подряд.
  const raw =
    1 +
    Number(password.length >= PASSWORD_MIN + 4) +
    Number(password.length >= PASSWORD_MIN + 8) +
    Number(classes >= 2) +
    Number(classes >= 3);

  const score = Math.min(raw, 4) as PasswordScore;
  return { score, label: LABELS[score] };
}
