// Только крипта, без next/headers: подпись/проверка пользовательской сессии. Отдельно от куки-слоя
// (player-session.ts) намеренно — этот модуль тянет в себя proxy.ts, а `next/headers` туда нельзя
// (та же причина, по которой auth.ts отделён от account.ts).
//
// В куке `lost_player` лежит `<id аккаунта>.<роль>.<срок>.<подпись>`. Роль вшита в подпись, чтобы
// proxy решал доступ к админке чистой криптой, не ходя в БД на каждый запрос. Плата — роль в куке
// обновляется при следующем входе: понизили админа до игрока, а его текущая кука ещё админская
// до перевхода/истечения. Для узкого круга доверенных это допустимо (см. DECISIONS.md).

import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "lost_player";
export const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней, как у админской куки

export type Role = "owner" | "admin" | "player";
const ROLES: Role[] = ["owner", "admin", "player"];
/** `iat` — когда сессия выдана. По нему отсекаются куки, выданные до смены пароля (`sessionsFrom`
 *  у аккаунта, проверка — в player-session.ts: здесь БД нет). У кук старого формата (без `iat`)
 *  это 0 — то есть «выдана раньше любого сброса». */
export type Session = { id: number; role: Role; iat: number };

// Секрет подписи. Отдельный от пароля админки: это разные роли, общий ключ смешал бы их сроки и
// «разлогины». Берём AUTH_SECRET, а когда его нет — GOOGLE_CLIENT_SECRET (он и так секрет, и есть
// ровно тогда, когда вход через Google включён). Пусто → сессии не выдаются и не принимаются.
const secret = () => process.env.AUTH_SECRET || process.env.GOOGLE_CLIENT_SECRET || "";

const sign = (data: string) => createHmac("sha256", secret()).update(data).digest("hex");

/** Сравнение фиксированной длины — по хешам, чтобы не мерить совпадение посимвольно по времени. */
function sameSig(a: string, b: string): boolean {
  const ha = createHmac("sha256", "cmp").update(a).digest();
  const hb = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Значение куки: `<id>.<role>.<exp>.<iat>.<подпись>`. Подпись покрывает id, роль, срок и выдачу. */
export function issueSession(accountId: number, role: Role): string {
  const now = Date.now();
  const body = `${accountId}.${role}.${now + TTL_MS}.${now}`;
  return `${body}.${sign(body)}`;
}

/** Сессия из валидной куки, либо null (нет секрета, подпись не сошлась, срок вышел, роль чужая). */
export function readSession(token: string | undefined): Session | null {
  if (!secret() || !token) return null;
  const cut = token.lastIndexOf(".");
  if (cut < 0) return null;
  const body = token.slice(0, cut); // `<id>.<role>.<exp>[.<iat>]`
  const sig = token.slice(cut + 1);
  const [rawId, rawRole, rawExp, rawIat] = body.split(".");
  const id = Number(rawId);
  const exp = Number(rawExp);
  if (!Number.isFinite(id) || !Number.isFinite(exp) || exp < Date.now()) return null;
  if (!ROLES.includes(rawRole as Role)) return null;
  if (!sameSig(sig, sign(body))) return null;
  // Куки, выданные до ТЗ 02, короче на одно поле. Ломать их незачем — они просто считаются
  // выданными «в начале времён»: любой сброс пароля их обнулит, а до сброса они в силе.
  const iat = Number(rawIat);
  return { id, role: rawRole as Role, iat: Number.isFinite(iat) ? iat : 0 };
}

/** Роль даёт доступ к служебной части. Зовётся из proxy — только крипта, без БД. */
export function sessionIsAdmin(token: string | undefined): boolean {
  const s = readSession(token);
  return !!s && (s.role === "owner" || s.role === "admin");
}
