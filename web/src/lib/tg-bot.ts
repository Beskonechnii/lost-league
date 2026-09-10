// Только сервер / скрипт: точка входа телеграм-бота — сюда приходит одно сообщение от человека и
// отсюда уходят ответы. Апдейты приносит `scripts/bot.ts` (long polling), сеть — `src/lib/telegram.ts`.
//
// Файл тонкий намеренно. До Э6 здесь жил рукописный автомат (`tg-quiz.ts`): пятьсот строк развилок
// по шагу диалога плюс россыпь перехватов в начале обработчика. Теперь весь разговор описан графом
// (`bot-flow/`), и на долю входа осталось ровно две работы: запомнить чат и отдать сообщение
// интерпретатору. Всё, что бот говорит и как ветвится, правится в `/admin/bot/flow`, а не здесь.
//
// Куда делся квиз заявки состава: он удалён вместе с `QUIZ_ROSTER` (`BOT-FLOW-PLAN.md`, Э6).
// Пятёрка набирается мышью из пула лиги на сайте (`/tournaments/<slug>/apply`) — пошаговый ввод
// ников в чате позволял вписать кого угодно мимо лиги, и бот теперь отдаёт туда ссылку.

import { sendTo, type Reply } from "./telegram";
import { rememberChat } from "./tg-menu";
import { linkTokenIn, redeemLinkToken } from "./tg-link";
import { respond } from "./bot-flow/run";

/**
 * Одно сообщение от человека → ответы бота.
 *
 * Ответ есть всегда: отдавать текст наружу больше некому, а упавшая нода превращается в извинение и
 * возврат в меню (`bot-flow/run.ts` → `guard`). Молчащий бот хуже бота, который признался.
 */
export async function handleMessage(
  chatId: string,
  raw: string,
  username?: string | null,
  tgId?: string | null,
  /** `file_id` присланной картинки, если сообщение было фото: его ждёт правка портрета в профиле. */
  photoFileId?: string | null,
): Promise<Reply[]> {
  // Чат запоминаем при каждом сообщении: позже по нему уйдёт решение организатора по заявке.
  await rememberChat(chatId, username);
  const text = raw.trim();

  // Привязка по ссылке с сайта (Э19) разбирается ДО графа — в отличие от `/start invite`, который
  // объявлен точкой входа своего флоу. Причина не в удобстве: хвост здесь не постоянное слово, а
  // одноразовый токен, и совпадением подписи (`entry.payloads`) его не поймать. Да и править
  // оператору тут нечего — это не разговор, а погашение ключа: заведомо один ответ на четыре
  // исхода (привязали / ссылка стара / телеграм занят / аккаунта нет).
  //
  // После ответа пропускаем человека в главный флоу обычным `/start`: он пришёл по ссылке впервые,
  // и оставить его перед пустым чатом — значит закончить привязку тупиком.
  const token = linkTokenIn(text);
  if (token) {
    const linked = await redeemLinkToken(token, { chatId, tgId, username });
    const menu = await respond({ chatId, text: "/start", username, tgId, photoFileId: null });
    return [{ text: linked.text }, ...menu];
  }

  return respond({ chatId, text, username, tgId, photoFileId });
}

/** Обработать сообщение и ответить в чат. Точка входа для `scripts/bot.ts`. */
export async function replyTo(
  chatId: string,
  text: string,
  username?: string | null,
  tgId?: string | null,
  photoFileId?: string | null,
): Promise<void> {
  const replies = await handleMessage(chatId, text, username, tgId, photoFileId);
  for (const r of replies) await sendTo(chatId, r.text, r.keyboard ?? null);
}
