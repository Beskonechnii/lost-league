// Только сервер: исходящие сообщения людям в телеграм — решения организатора: по заявке команды и
// по анкете игрока, поданной в боте.
//
// **Написать можно лишь тому, кто сам писал боту.** Telegram не отдаёт чат по хендлу, поэтому чат
// подавшего запоминается вместе с заявкой (`TeamApplication.submittedChatId`), а остальные — в
// `TgChat` при каждом их сообщении. Кому чата не нашлось, того не уведомляем: молча и без ошибки,
// организатор и так свяжется с капитаном.
//
// Отправка не должна ломать решение оператора: апрув уже записан в БД, и упавший телеграм — повод
// написать в консоль, а не откатить одобрение команды. Поэтому все функции здесь глотают ошибку.

import { prisma } from "./prisma";
import { botConfigured, sendTo } from "./telegram";
import { parseDraft } from "./team-application";
import { normalizeTelegram } from "./profiles";
import { MENU } from "./tg-menu";
import { REGISTER_BUTTON } from "./tg-register";

/** Чаты, куда стоит написать про эту заявку: подавший плюс те игроки состава, что писали боту. */
async function recipients(applicationId: number): Promise<string[]> {
  const application = await prisma.teamApplication.findUnique({ where: { id: applicationId } });
  if (!application) return [];

  const chats = new Set<string>();
  if (application.submittedChatId) chats.add(application.submittedChatId);

  const handles = (parseDraft(application.payload)?.players ?? [])
    .map((p) => normalizeTelegram(p.telegram ?? ""))
    .filter((h): h is string => !!h)
    .map((h) => h.toLowerCase());
  if (handles.length) {
    // Хендлы сравниваем в памяти: sqlite через Prisma не умеет `mode: "insensitive"`, а знакомых
    // чатов у бота столько же, сколько людей в лиге.
    const known = await prisma.tgChat.findMany({ where: { username: { not: null } } });
    for (const c of known) if (handles.includes(c.username!.toLowerCase())) chats.add(c.chatId);
  }
  return [...chats];
}

/** Разослать текст по чатам заявки. Ошибку конкретного чата не разносим: человек мог заблокировать бота. */
async function tell(applicationId: number, text: string): Promise<void> {
  if (!botConfigured()) return;
  try {
    for (const chatId of await recipients(applicationId)) {
      await sendTo(chatId, text).catch((e) => console.error(`Не доставлено в чат ${chatId}:`, e));
    }
  } catch (e) {
    console.error("Не удалось разослать решение по заявке:", e);
  }
}

/** Команду завели в лигу. */
export async function notifyApproved(applicationId: number, teamName: string): Promise<void> {
  await tell(
    applicationId,
    `<b>${teamName}</b> — заявка одобрена, команда заведена в лигу. Состав и ближайшие встречи — «Мой состав».`,
  );
}

/** Заявку вернули. Причина обязательна и в самом уведомлении: без неё нечего исправлять. */
export async function notifyRejected(applicationId: number, teamName: string, reason: string): Promise<void> {
  await tell(
    applicationId,
    `<b>${teamName}</b> — заявку вернул организатор: ${reason}\n\nПоправьте и подайте заново — «Подать заявку».`,
  );
}


// ── решение по анкете игрока (регистрация в боте) ────────────────────────────
//
// Чат берём по привязке `TgChat.accountId` — её ставит регистрация (`account.ts`). Запасной ход по
// хендлу оставлен на случай, когда человек писал боту с другого устройства и привязку получил не
// тот чат: сказать о решении важнее, чем угадать один-единственный правильный.

async function accountChats(accountId: number): Promise<string[]> {
  const account = await prisma.userAccount.findUnique({
    where: { id: accountId },
    select: { tgUsername: true },
  });
  const chats = new Set<string>();
  for (const c of await prisma.tgChat.findMany({ where: { accountId } })) chats.add(c.chatId);

  const handle = normalizeTelegram(account?.tgUsername ?? "");
  if (handle) {
    const known = await prisma.tgChat.findMany({ where: { username: { not: null } } });
    for (const c of known) if (c.username!.toLowerCase() === handle.toLowerCase()) chats.add(c.chatId);
  }
  return [...chats];
}

/** Разослать текст по чатам аккаунта. Ошибку глотаем: решение оператора уже записано. */
async function tellAccount(accountId: number, text: string): Promise<void> {
  if (!botConfigured()) return;
  try {
    for (const chatId of await accountChats(accountId)) {
      await sendTo(chatId, text).catch((e) => console.error(`Не доставлено в чат ${chatId}:`, e));
    }
  } catch (e) {
    console.error("Не удалось разослать решение по анкете:", e);
  }
}

/** Анкету одобрили — человек в ростере. */
export async function notifyRegistrationApproved(accountId: number, nickname: string): Promise<void> {
  await tellAccount(
    accountId,
    `<b>${nickname}</b> — вы в лиге. Профиль заведён в ростере, смотрите «${MENU.profile}».`,
  );
}

/** Анкету вернули. Причина обязательна и в самом уведомлении: без неё нечего исправлять. */
export async function notifyRegistrationRejected(accountId: number, reason: string): Promise<void> {
  await tellAccount(
    accountId,
    `Анкету вернул организатор: ${reason}\n\nПоправьте и пришлите снова — «${REGISTER_BUTTON}».`,
  );
}
