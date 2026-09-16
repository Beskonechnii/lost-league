// Только сервер: сброс забытого пароля по одноразовой ссылке (ТЗ 02).
//
// **Почему не «ссылка на почту».** Писем приложение не шлёт вовсе — почтовый флоу убран сознательно
// (`DECISIONS.md`, 20.08.2026), ключей почты в `.env` нет. Возвращать его ради одной кнопки дороже,
// чем использовать каналы, которые у лиги уже есть и которые надёжнее почты:
//   · телеграм — человек сам жмёт «Забыли пароль?», и ссылка приходит ему в бот (`tgId`, Э19);
//   · оператор — владелец или админ выдаёт ссылку в админке и передаёт её адресату сам.
// Третьего пути нет намеренно: секретные вопросы слабее пароля, который они защищают.
//
// **Механика — та же, что у `tg-link.ts`.** Длинный случайный секрет в ссылке, один живой токен на
// аккаунт, сгорает при первом использовании, живёт полчаса. Второй реализации одноразового токена
// в проекте заводить незачем — отсюда и одинаковые `deleteMany`/`updateMany`-приёмы.
//
// **Чего здесь нет — ответа «такого аккаунта нет».** Форма запроса отвечает одинаково всем, иначе
// она превращается в проверялку чужих почт: подставил адрес, получил «аккаунт не найден» — и знаешь,
// кто в лиге есть. Поэтому `requestReset` наружу не возвращает ничего, кроме лимита.

import "server-only";
import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "./prisma";
import { isOwnerEmail, requirePermission } from "./account";
import { hashPassword, passwordProblem } from "./password";
import { clientIpFromHeaders, takeResetRequest } from "./rate-limit";
import { siteUrl } from "./site";
import { notifyPasswordReset } from "./tg-notify";

/** Сколько живёт ссылка. Как у привязки телеграма: между «нажал» и «открыл» бывает пауза. */
export const RESET_TTL_MIN = 30;

/** Адрес страницы, где задаётся новый пароль. Один на оба пути — и самостоятельный, и через оператора. */
export const resetPath = (token: string): string => `/login/reset/${token}`;

const newToken = (): string => randomBytes(24).toString("base64url");

/**
 * Выдать ссылку сброса. Прежние токены аккаунта гасим — живой ровно один: иначе брошенная вкладка
 * недельной давности оставалась бы рабочим ключом. Заодно подчищаем просроченные.
 *
 * `issuedById` — аккаунт оператора, если сброс заказан из админки; null — человек сам.
 */
export async function issueResetUrl(accountId: number, issuedById: number | null = null): Promise<string> {
  const now = new Date();
  await prisma.passwordResetToken.deleteMany({ where: { OR: [{ accountId }, { expiresAt: { lt: now } }] } });

  const token = newToken();
  await prisma.passwordResetToken.create({
    data: { token, accountId, issuedById, expiresAt: new Date(now.getTime() + RESET_TTL_MIN * 60_000) },
  });
  return `${siteUrl()}${resetPath(token)}`;
}

/** Почему ссылка не сработала. Разные экраны, а не один алерт: «протухла» и «уже использована» —
 *  это разные истории, и в первой человеку надо просто запросить новую. */
export type ResetTokenState = "ok" | "unknown" | "expired" | "used";

/** Состояние ссылки без её гашения — для отрисовки страницы (GET). Гасит только `redeemReset`. */
export async function readResetToken(token: string): Promise<ResetTokenState> {
  const row = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!row) return "unknown";
  if (row.usedAt) return "used";
  if (row.expiresAt < new Date()) return "expired";
  return "ok";
}

export type RedeemResult = { ok: true } | { ok: false; state: ResetTokenState } | { ok: false; error: string };

/**
 * Погасить ссылку и поставить новый пароль.
 *
 * Правила пароля — общие с регистрацией (`passwordProblem`): второго набора требований в проекте
 * нет и заводить его нельзя, иначе подсказка под полем и отказ сервера разъедутся.
 *
 * Сессии аккаунта обнуляются тем же движением (`sessionsFrom`): смысл сброса — вернуть аккаунт
 * себе, а не поделиться им с тем, кто уже сидит внутри с чужой кукой.
 */
export async function redeemReset(token: string, password: string): Promise<RedeemResult> {
  const row = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!row) return { ok: false, state: "unknown" };
  if (row.usedAt) return { ok: false, state: "used" };
  if (row.expiresAt < new Date()) return { ok: false, state: "expired" };

  const account = await prisma.userAccount.findUnique({
    where: { id: row.accountId },
    // Почта и ник — контекст правил: новый пароль не должен их повторять.
    select: { id: true, email: true, player: { select: { nickname: true } } },
  });
  if (!account) return { ok: false, state: "unknown" };

  const problem = passwordProblem(password, { email: account.email ?? undefined, nickname: account.player?.nickname });
  if (problem) return { ok: false, error: problem };

  const now = new Date();
  // Гасим условием `usedAt: null`, а не чтением-записью: две одновременные отправки не должны обе
  // сменить пароль. Тот же приём, что у кода входа и у привязки телеграма.
  const burned = await prisma.passwordResetToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: now },
  });
  if (burned.count === 0) return { ok: false, state: "used" };

  await prisma.userAccount.update({
    where: { id: account.id },
    data: {
      passwordHash: hashPassword(password),
      sessionsFrom: now, // всё, что выдано раньше этой секунды, больше не сессия
      passwordResetAt: now,
      passwordResetById: row.issuedById,
    },
  });
  return { ok: true };
}

/**
 * Сброс оператором: выдать ссылку на чужой аккаунт (ТЗ 02, раздел в «Команде лиги»).
 *
 * Три ограничения, и все три — про то, чтобы сброс не стал способом залезть в чужой аккаунт:
 *   · право `accounts.admins` — то же, которым назначают админов: кто может выдать роль, тот тем
 *     более может вернуть человеку вход, а заводить ради одной кнопки ещё один ключ в реестре
 *     прав незачем;
 *   · владельцу сброс недоступен — иначе админ, которому владелец сам выдал права, одной кнопкой
 *     получал бы ссылку на аккаунт, который не может разжаловать;
 *   · себе — тоже: свой пароль меняется в кабинете, где спрашивают текущий.
 *
 * Оператор получает только ссылку — ни старого пароля, ни нового он не видит и задать не может:
 * пароль придумывает владелец аккаунта на странице по ссылке.
 */
export async function issueOperatorReset(targetId: number): Promise<string> {
  const actor = await requirePermission("accounts.admins");
  if (actor.id === targetId) throw new Error("Свой пароль меняется в кабинете, а не отсюда");

  const target = await prisma.userAccount.findUnique({ where: { id: targetId }, select: { email: true, role: true } });
  if (!target) throw new Error("Аккаунт не найден");
  if (target.role === "owner" || isOwnerEmail(target.email)) {
    throw new Error("Аккаунт владельца лиги через админку не сбрасывается");
  }

  // След действия: кто и кому выдал ссылку. В самой записи токена это тоже есть (`issuedById`),
  // но там оно живёт полчаса и исчезает вместе с токеном, а в журнале процесса остаётся.
  console.warn(`Сброс пароля: аккаунт #${actor.id} выдал ссылку аккаунту #${targetId}`);
  return issueResetUrl(targetId, actor.id);
}

export type RequestVerdict = { ok: true } | { ok: false; error: string };

/**
 * Запрос сброса с публичной формы: по почте найти аккаунт и, если у него привязан телеграм,
 * отправить туда ссылку.
 *
 * Наружу — только «приняли» либо отказ лимита. Ни «нашли», ни «телеграма нет» здесь не отдаётся:
 * экран на все случаи один, иначе форма читает чужие почты по разнице ответов.
 */
export async function requestReset(email: string): Promise<RequestVerdict> {
  const mail = email.trim().toLowerCase();
  const ip = clientIpFromHeaders(await headers());

  const slot = takeResetRequest(mail, ip);
  if (!slot.ok) {
    const minutes = Math.max(1, Math.ceil(slot.retryAfterSec / 60));
    return { ok: false, error: `Слишком много запросов. Попробуйте через ${minutes} мин.` };
  }

  const account = mail
    ? await prisma.userAccount.findUnique({ where: { email: mail }, select: { id: true, tgId: true } })
    : null;
  if (account?.tgId) {
    const url = await issueResetUrl(account.id);
    await notifyPasswordReset(account.id, url, RESET_TTL_MIN);
  }
  return { ok: true };
}
