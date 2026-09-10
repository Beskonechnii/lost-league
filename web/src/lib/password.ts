// Чистая крипта пароля — без next/headers и без БД (как player-auth.ts). scrypt из node:crypto:
// свой хеш, без внешних зависимостей — в стиле проекта, где вся крипта самописная. Формат хранения
// `salt:hash` (обе половины hex): соль случайная на каждый пароль, сравнение — timing-safe.

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Правила к паролю живут в чистом `password-rules.ts` (их зовёт и форма в браузере), а сюда
// реэкспортируются — чтобы вызывающим (`account.ts`) не пришлось знать про два модуля.
export { passwordProblem, PASSWORD_MIN, type PasswordContext } from "./password-rules";

const KEYLEN = 64; // длина производного ключа в байтах

/** Хеш пароля для БД: `<salt hex>:<hash hex>`. Соль своя у каждого — одинаковые пароли дают разный хеш. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

/** Проверка пароля против хранимого хеша. false при любом расхождении формата/длины/значения. */
export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== KEYLEN) return false;
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), KEYLEN);
  // Длины равны (обе KEYLEN) — timingSafeEqual не бросит; сравнение постоянного времени.
  return timingSafeEqual(actual, expected);
}
