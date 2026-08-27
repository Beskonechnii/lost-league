// Только сервер / скрипт: вход на сайт по одноразовому коду из бота. Бот выдаёт шесть цифр,
// человек вводит их на `/login/tg`, и сайт выдаёт ту же подписанную куку сессии, что и вход по
// паролю (`src/lib/player-session.ts`).
//
// **Почему код, а не Telegram Login Widget.** Виджету нужен домен, привязанный к боту в BotFather,
// а у нас пока туннель и невыбранный VPS (`BACKLOG.md` §1) — вход не должен ждать выката. После
// переезда виджет добавится второй кнопкой на `/me`, не вместо этого пути (`DEPLOY.md`).
//
// **Почему вообще нужен второй вход.** У пришедшего из телеграма нет ни почты, ни пароля
// (`tg-register.ts`): единственный его ключ — `UserAccount.tgId`. Без этого кода на сайт ему нечем
// попасть, а сборка состава и кабинет живут именно там.
//
// Модуль зовёт бот (обычный node), поэтому здесь нет ни `server-only`, ни `next/headers` — куку
// ставит уже сайт. Та же причина, что у `team-application.ts` и `tg-register.ts`.

import { randomInt } from "node:crypto";
import { prisma } from "./prisma";

/** Сколько живёт код. Достаточно, чтобы переключиться на компьютер, и мало, чтобы код не валялся. */
export const CODE_TTL_MIN = 10;

const CODE_LEN = 6;

/** Адрес сайта для ссылки из бота. Локально по умолчанию тот же, на котором крутится `npm run dev`. */
export const siteUrl = (): string => (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");

export const loginUrl = (): string => `${siteUrl()}/login/tg`;

/** Аккаунт, которому можно выдать код: привязка из регистрации в боте. Хендл ключом не годится. */
export async function loginAccount(tgId: string | null | undefined): Promise<{ id: number } | null> {
  if (!tgId) return null;
  return prisma.userAccount.findUnique({ where: { tgId }, select: { id: true } });
}

/**
 * Выдать код. Прежний код этого аккаунта гасим: живой должен быть один — тогда подбор шестизначного
 * числа упирается в одну цель со сроком в десять минут, а не в «любой из накопленных». Заодно
 * подчищаем просроченные: коды одноразовые, копить их в таблице незачем.
 */
export async function issueLoginCode(accountId: number): Promise<{ code: string; expiresAt: Date }> {
  const now = new Date();
  await prisma.tgLoginCode.deleteMany({ where: { OR: [{ accountId }, { expiresAt: { lt: now } }] } });

  const expiresAt = new Date(now.getTime() + CODE_TTL_MIN * 60_000);
  // Код случайный (`randomInt` — из crypto, а не Math.random: это ключ от аккаунта). Коллизия по
  // уникальному индексу возможна, пока чужой код ещё жив, — тогда просто берём другое число.
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = String(randomInt(0, 10 ** CODE_LEN)).padStart(CODE_LEN, "0");
    try {
      await prisma.tgLoginCode.create({ data: { code, accountId, expiresAt } });
      return { code, expiresAt };
    } catch {
      // занят — следующая попытка
    }
  }
  throw new Error("Не удалось выдать код входа");
}

export type Redeemed = { ok: true; accountId: number } | { ok: false; error: string };

/**
 * Проверить код и погасить его. Наружу отдаём только id аккаунта: куку ставит сайт
 * (`establishSession`), потому что роль и владелец — уже его дело.
 */
export async function redeemLoginCode(raw: string): Promise<Redeemed> {
  const code = raw.replace(/\D+/g, ""); // код могли набрать с пробелом или скопировать с точкой
  if (code.length !== CODE_LEN) return { ok: false, error: "Код — шесть цифр из бота." };

  const row = await prisma.tgLoginCode.findUnique({ where: { code } });
  // Одна формулировка на «нет такого» и «уже потратили»: подсказывать, какой код существует, а
  // какой нет, — значит помогать перебирать.
  const stale = { ok: false as const, error: `Код не подошёл или устарел. Запросите новый в боте — он живёт ${CODE_TTL_MIN} минут.` };
  if (!row || row.usedAt || row.expiresAt < new Date()) return stale;

  // Гасим условием `usedAt: null`, а не чтением-записью: два одновременных ввода не должны оба
  // стать входом.
  const burned = await prisma.tgLoginCode.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (burned.count === 0) return stale;

  return { ok: true, accountId: row.accountId };
}
