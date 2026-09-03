// Только сервер: исходящие сообщения людям в телеграм — решения организатора: по заявке команды,
// по анкете игрока, поданной в боте, и по правке его профиля.
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
import { INVITE_NO, INVITE_YES } from "./tg-invites";
import { REGISTER_BUTTON } from "./tg-register";
import { EDIT_BUTTON } from "./tg-profile";
import { fieldLabel } from "./profile-edit";

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
    `<b>${teamName}</b> — заявка одобрена, команда заведена в лигу. Состав и ближайшие встречи — «Турниры» → ваш турнир → «Моя команда».`,
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

// ── позвали в состав на турнир ───────────────────────────────────────────────
//
// Отдельно от `tell(applicationId)`: та пишет ВСЕМ чатам заявки одним текстом («заявку одобрили»),
// а здесь адресное — каждому позванному про него самого. Чат ищем по игроку: сперва привязанный
// к нему аккаунт (`UserAccount.playerId`), потом телеграм-хендл из профиля. Не нашлось — молчим:
// человек просто увидит приглашение в кабинете, когда зайдёт.

async function playerChats(playerId: number): Promise<string[]> {
  const chats = new Set<string>();
  const account = await prisma.userAccount.findFirst({ where: { playerId }, select: { id: true } });
  if (account) for (const c of await accountChats(account.id)) chats.add(c);

  const player = await prisma.player.findUnique({ where: { id: playerId }, select: { telegram: true } });
  const handle = normalizeTelegram(player?.telegram ?? "");
  if (handle) {
    const known = await prisma.tgChat.findMany({ where: { username: { not: null } } });
    for (const c of known) if (c.username!.toLowerCase() === handle.toLowerCase()) chats.add(c.chatId);
  }
  return [...chats];
}

/**
 * Капитан вписал человека в состав. Уведомляем только тех, кого позвали ИМЕННО СЕЙЧАС
 * (`syncApplicationMembers` их и возвращает): при каждой правке заявки писать всему составу
 * значит превратить уведомление в спам.
 *
 * Ответить можно в кабинете — ссылку и даём: своей кнопки у бота на это пока нет, а звать
 * человека без способа ответить бессмысленно.
 */
export async function notifyRosterInvites(
  rows: { playerId: number | null; nickname: string; application: { tournament: { name: string } } }[],
  teamName: string,
): Promise<void> {
  if (!botConfigured()) return;
  for (const row of rows) {
    if (!row.playerId) continue; // человека ещё нет в лиге — писать некому
    try {
      for (const chatId of await playerChats(row.playerId)) {
        await sendTo(
          chatId,
          `Вас заявили в состав <b>${teamName}</b> на турнир <b>${row.application.tournament.name}</b>.\n\n` +
            `Ответить можно прямо здесь кнопкой — или в кабинете на сайте, раздел «Приглашения».`,
          // Клавиатура и есть вход в сценарий ответа: подписи объявлены точкой входа флоу
          // `roster-invite` (`bot-flow/default-flow.ts`), поэтому кнопку жмут из любого места
          // разговора и хоть через неделю.
          [[INVITE_YES], [INVITE_NO]],
        ).catch((e) => console.error(`Не доставлено в чат ${chatId}:`, e));
      }
    } catch (e) {
      console.error("Не удалось позвать игрока в состав:", e);
    }
  }
}

// ── решение по правке профиля ────────────────────────────────────────────────
//
// Чат берём из самой правки (`ProfileEditRequest.chatId`): она пришла из бота, и отвечать надо
// туда же — почты у пришедшего из телеграма нет, а кабинет он открывает не каждый день.

/** Правку приняли — профиль уже изменён. */
export async function notifyProfileEditApproved(requestId: number): Promise<void> {
  const request = await prisma.profileEditRequest.findUnique({ where: { id: requestId } });
  if (!request?.chatId || !botConfigured()) return;
  await sendTo(
    request.chatId,
    `Правка принята: <b>${fieldLabel(request.field)}</b> в профиле обновлено. Посмотреть — «${MENU.profile}».`,
  ).catch((e) => console.error(`Не доставлено в чат ${request.chatId}:`, e));
}

/** Правку вернули. Причина обязательна и в самом уведомлении: без неё нечего исправлять. */
export async function notifyProfileEditRejected(requestId: number, reason: string): Promise<void> {
  const request = await prisma.profileEditRequest.findUnique({ where: { id: requestId } });
  if (!request?.chatId || !botConfigured()) return;
  await sendTo(
    request.chatId,
    `Правку поля <b>${fieldLabel(request.field)}</b> вернул организатор: ${reason}\n\n` +
      `Поправить и прислать снова — «${MENU.profile}» → «${EDIT_BUTTON}».`,
  ).catch((e) => console.error(`Не доставлено в чат ${request.chatId}:`, e));
}
