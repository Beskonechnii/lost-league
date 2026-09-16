// Только сервер: куки-слой пользовательской сессии поверх крипты из player-auth.ts. Здесь живёт
// `next/headers`, поэтому этот модуль в proxy.ts не тянут (там только чистый player-auth.ts).

import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { SESSION_COOKIE, TTL_MS, issueSession, readSession, type Role, type Session } from "./player-auth";

const cookieOpts = {
  httpOnly: true, // из JS куку не прочитать
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production", // на localhost по http кука бы не поставилась
  path: "/",
};

/** `remember` — «Запомнить меня»: без него кука сессионная (гаснет с закрытием браузера),
 *  хотя подписанный токен внутри и так живёт TTL_MS. С флагом кука получает тот же срок явно. */
export async function setSessionCookie(accountId: number, role: Role, remember = false): Promise<void> {
  const opts = remember ? { ...cookieOpts, maxAge: TTL_MS / 1000 } : cookieOpts;
  (await cookies()).set(SESSION_COOKIE, issueSession(accountId, role), opts);
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Сессия текущего запроса (id + роль из куки), либо null. */
export async function currentSession(): Promise<Session | null> {
  const signed = readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!signed) return devSession();
  return (await sessionRevoked(signed)) ? null : signed;
}

/**
 * Отозвана ли сессия сменой пароля (ТЗ 02). Кука подписана и живёт 30 дней — сама по себе она
 * переживает и смену пароля, и сброс через оператора: угнавший её остался бы внутри аккаунта,
 * который человек «вернул себе». Поэтому смена пароля поднимает `UserAccount.sessionsFrom`,
 * и всё, что выдано раньше, перестаёт действовать.
 *
 * Цена — один крошечный запрос по первичному ключу на запрос со входом. Осознанно: тот же размен,
 * что у прав в `account.ts` («лишний запрос дешевле дырки в доступе»). `cache()` схлопывает его
 * до одного на рендер — `currentSession` за запрос зовут несколько раз.
 */
const sessionsFrom = cache(async (accountId: number): Promise<number> => {
  const acc = await prisma.userAccount.findUnique({ where: { id: accountId }, select: { sessionsFrom: true } });
  return acc?.sessionsFrom?.getTime() ?? 0;
});

async function sessionRevoked(session: Session): Promise<boolean> {
  const from = await sessionsFrom(session.id);
  return from > 0 && session.iat < from;
}

/** id вошедшего аккаунта, либо null. */
export async function currentAccountId(): Promise<number | null> {
  return (await currentSession())?.id ?? null;
}

// ── dev-автовход ──────────────────────────────────────────────────────────────
//
// Локально проверять админку удобнее без ручного входа после каждого перезапуска/смены секрета,
// поэтому `DEV_LOGIN_EMAIL` в web/.env подставляет сессию аккаунта с этой почтой, когда куки нет.
// Живёт только вне production: на бою переменная игнорируется, иначе одна строка окружения открыла
// бы служебную часть. Проверка идёт по БД, то есть роль и права остаются настоящими.

const devLoginEmail = () =>
  process.env.NODE_ENV === "production" ? "" : (process.env.DEV_LOGIN_EMAIL ?? "").trim().toLowerCase();

let devSessionCache: Session | null | undefined; // память процесса: незачем ходить в БД на каждый запрос

async function devSession(): Promise<Session | null> {
  const email = devLoginEmail();
  if (!email) return null;
  if (devSessionCache === undefined) {
    // account.ts сам тянет этот модуль — импорт динамический, чтобы цикл разрешался в рантайме.
    const { effectiveRole } = await import("./account");
    const acc = await prisma.userAccount.findFirst({ where: { email }, select: { id: true, email: true, role: true } });
    if (!acc) console.warn(`DEV_LOGIN_EMAIL=${email}: аккаунта с такой почтой в базе нет`);
    // `iat: Date.now()` — автовход выдаётся сейчас, а значит переживает любой прошлый сброс:
    // иначе смена пароля на локальной машине выбивала бы разработчика навсегда.
    devSessionCache = acc ? { id: acc.id, role: effectiveRole(acc), iat: Date.now() } : null;
  }
  return devSessionCache;
}
