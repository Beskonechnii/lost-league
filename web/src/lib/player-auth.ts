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
export type Session = { id: number; role: Role };

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

/** Значение куки: `<id>.<role>.<exp>.<подпись>`. Подпись покрывает id, роль и срок. */
export function issueSession(accountId: number, role: Role): string {
  const body = `${accountId}.${role}.${Date.now() + TTL_MS}`;
  return `${body}.${sign(body)}`;
}

/** Сессия из валидной куки, либо null (нет секрета, подпись не сошлась, срок вышел, роль чужая). */
export function readSession(token: string | undefined): Session | null {
  if (!secret() || !token) return null;
  const cut = token.lastIndexOf(".");
  if (cut < 0) return null;
  const body = token.slice(0, cut); // `<id>.<role>.<exp>`
  const sig = token.slice(cut + 1);
  const [rawId, rawRole, rawExp] = body.split(".");
  const id = Number(rawId);
  const exp = Number(rawExp);
  if (!Number.isFinite(id) || !Number.isFinite(exp) || exp < Date.now()) return null;
  if (!ROLES.includes(rawRole as Role)) return null;
  if (!sameSig(sig, sign(body))) return null;
  return { id, role: rawRole as Role };
}

/** Роль даёт доступ к служебной части. Зовётся из proxy — только крипта, без БД. */
export function sessionIsAdmin(token: string | undefined): boolean {
  const s = readSession(token);
  return !!s && (s.role === "owner" || s.role === "admin");
}
