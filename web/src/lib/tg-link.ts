// Только сервер / скрипт: привязка телеграма к аккаунту лиги по ссылке с одноразовым токеном
// (RELEASE-PLAN §E, Э19). Сайт выдаёт вошедшему ссылку `t.me/<бот>?start=link_<token>`, человек
// жмёт Start, и бот получает его `from.id` — этим `tgId` аккаунт и подписывается.
//
// **Зачем.** До этого телеграм спрашивался полем в анкете: `@nickname` руками. Такой хендл не
// проверяет никто — опечатка равна потерянному контакту, а лига узнаёт об этом в тот момент, когда
// человеку надо срочно написать. Пришедший через Start `from.id` не опечатать: он приходит от
// Telegram, а вместе с ним — `chat_id`, то есть канал, в который сообщение правда дойдёт.
// (Написать по хендлу Bot API не даёт вовсе — только в чат, который уже писал боту.)
//
// **Пара к `tg-login.ts`, но в другую сторону.** Там бот подтверждает человека сайту (код из шести
// цифр), здесь сайт подтверждает человека боту. Отсюда и разный вид секрета: код набирают руками —
// он короткий; токен приезжает в ссылке — он длинный и случайный.
//
// Модуль зовёт бот (обычный node), поэтому здесь нет ни `server-only`, ни `next/headers`. Та же
// причина, что у `tg-login.ts` и `tg-register.ts`.

import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { botStartLink } from "./telegram";
import { syncShards } from "./shards";

/** Сколько живёт токен. Дольше кода входа: между «нажал на сайте» и «открыл телеграм» бывает пауза. */
export const LINK_TTL_MIN = 30;

/** Префикс полезной нагрузки. Своим графам бот отдаёт хвосты без него (`invite`), так что перепутать нечем. */
const PAYLOAD_PREFIX = "link_";

/** Токен из ссылки: 16 случайных байт в base64url — 22 символа, в лимит payload'а Telegram (64) влезает. */
const newToken = (): string => randomBytes(16).toString("base64url");

/** Текст `/start link_<token>` → сам токен. Не наша ссылка — `null`, и сообщение уходит в граф как обычно. */
export function linkTokenIn(text: string): string | null {
  const m = /^\/start(?:@\S+)?\s+link_([A-Za-z0-9_-]{8,64})$/.exec(text.trim());
  return m ? m[1] : null;
}

/**
 * Выдать ссылку на привязку. Прежние токены аккаунта гасим — живой ровно один: иначе брошенная
 * вкладка недельной давности оставалась бы рабочим ключом к аккаунту. Заодно подчищаем просроченные.
 *
 * Бот не настроен (`TG_BOT_TOKEN` пуст) или Telegram не ответил — `null`, и экран объясняет это
 * словами: ссылка на несуществующего бота выглядит рабочей, а ведёт в никуда.
 */
export async function issueLinkUrl(accountId: number): Promise<string | null> {
  const now = new Date();
  await prisma.tgLinkToken.deleteMany({ where: { OR: [{ accountId }, { expiresAt: { lt: now } }] } });

  const token = newToken();
  await prisma.tgLinkToken.create({
    data: { token, accountId, expiresAt: new Date(now.getTime() + LINK_TTL_MIN * 60_000) },
  });
  return botStartLink(`${PAYLOAD_PREFIX}${token}`);
}

/** Чем кончилась привязка: `ok` — привязали (или подтвердили уже привязанное), иначе объяснение отказом. */
export type LinkResult = { ok: boolean; text: string };

/**
 * Погасить токен и подписать аккаунт этим телеграмом. Зовёт бот, приняв `/start link_…`.
 *
 * Три отказа, каждый со своей причиной:
 *   · токена нет / просрочен / потрачен — ссылка старая, надо взять новую на сайте;
 *   · этот телеграм уже привязан к ДРУГОМУ аккаунту — молча перевесить нельзя: у того аккаунта
 *     `tgId` может быть единственным входом (`tg-register.ts`), и он бы его потерял;
 *   · аккаунт по токену исчез (удалён, пока ссылка лежала в чате).
 *
 * Замена собственной прежней привязки, наоборот, разрешена: токен выдан вошедшему хозяину аккаунта,
 * и «сменил телеграм» — обычное дело.
 */
export async function redeemLinkToken(
  token: string,
  ctx: { tgId: string | null | undefined; chatId: string; username?: string | null },
): Promise<LinkResult> {
  const stale = {
    ok: false,
    text:
      `Ссылка не подошла — она одноразовая и живёт ${LINK_TTL_MIN} минут. ` +
      "Откройте на сайте «Настройки → Телеграм» и нажмите «Привязать» ещё раз.",
  };
  if (!ctx.tgId) return { ok: false, text: "Не разобрал, от кого сообщение, — привязать не могу." };

  const row = await prisma.tgLinkToken.findUnique({ where: { token } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return stale;

  // Гасим условием `usedAt: null`, а не чтением-записью: две одновременные попытки не должны обе
  // стать привязкой. Тот же приём, что у кода входа.
  const burned = await prisma.tgLinkToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (burned.count === 0) return stale;

  const account = await prisma.userAccount.findUnique({ where: { id: row.accountId }, select: { id: true, tgId: true } });
  if (!account) return { ok: false, text: "Аккаунт, для которого выдана ссылка, больше не существует." };

  const owner = await prisma.userAccount.findUnique({ where: { tgId: ctx.tgId }, select: { id: true } });
  if (owner && owner.id !== account.id) {
    return {
      ok: false,
      text:
        "Этот телеграм уже привязан к другому аккаунту лиги. Войдите в него на сайте — " +
        "или сперва отвяжите телеграм там, в «Настройках».",
    };
  }

  const username = ctx.username?.replace(/^@/, "").trim() || null;
  await prisma.userAccount.update({ where: { id: account.id }, data: { tgId: ctx.tgId, tgUsername: username } });
  // Чат закрепляем за аккаунтом — по нему уходят решения модерации и приглашения в состав
  // (`tg-notify.ts`). Строка чата к этому моменту уже есть: её завёл `rememberChat`.
  await prisma.tgChat.updateMany({ where: { chatId: ctx.chatId }, data: { accountId: account.id } });
  // Привязанный телеграм — веха осколков (lib/shards.ts). Одобренному начислится сразу, ждущему
  // решения — при апруве: гейт стоит внутри syncShards, звать её можно откуда угодно.
  await syncShards(account.id);

  const again = account.tgId === ctx.tgId;
  return {
    ok: true,
    text: again
      ? "Этот телеграм уже был привязан к вашему аккаунту — всё в порядке, ничего менять не пришлось."
      : "Готово: телеграм привязан к аккаунту лиги. Теперь сюда придут решения по заявке и приглашения в состав, " +
        "а на сайт можно входить по коду отсюда.",
  };
}

/** Снять привязку (кнопка в настройках). Чат аккаунта тоже отпускаем: писать в него больше некому. */
export async function unlinkTelegram(accountId: number): Promise<void> {
  await prisma.userAccount.update({ where: { id: accountId }, data: { tgId: null, tgUsername: null } });
  await prisma.tgChat.updateMany({ where: { accountId }, data: { accountId: null } });
  await prisma.tgLinkToken.deleteMany({ where: { accountId } });
}
