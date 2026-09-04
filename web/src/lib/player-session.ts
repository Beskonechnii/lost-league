// Только сервер: куки-слой пользовательской сессии поверх крипты из player-auth.ts. Здесь живёт
// `next/headers`, поэтому этот модуль в proxy.ts не тянут (там только чистый player-auth.ts).

import { cookies } from "next/headers";
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
  return readSession((await cookies()).get(SESSION_COOKIE)?.value) ?? (await devSession());
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
    const [{ prisma }, { effectiveRole }] = await Promise.all([import("./prisma"), import("./account")]);
    const acc = await prisma.userAccount.findFirst({ where: { email }, select: { id: true, email: true, role: true } });
    if (!acc) console.warn(`DEV_LOGIN_EMAIL=${email}: аккаунта с такой почтой в базе нет`);
    devSessionCache = acc ? { id: acc.id, role: effectiveRole(acc) } : null;
  }
  return devSessionCache;
}
