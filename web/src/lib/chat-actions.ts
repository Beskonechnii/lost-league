import "server-only";
import { prisma } from "./prisma";
import { respondToInvite } from "./team-invites";
import type { ActionState, ChatAction } from "./chat-events";

// Реестр системных сообщений с выбором: что лига может спросить у человека прямо в переписке.
//
// Зачем реестр, а не поле «кнопки» в сообщении. Кнопка без смысла бесполезна: нажатие должно
// что-то СДЕЛАТЬ — записать ответ на приглашение, подтвердить время встречи. Значит, у каждого
// вида сообщения есть свой обработчик, и держать его надо там же, где подписи кнопок, иначе
// подпись и действие разъедутся на первой же правке.
//
// **Состояние выбора здесь не хранится.** Ответ живёт в самой сущности (`TeamApplicationMember.status`),
// а сообщение только показывает её: иначе у одного факта стало бы две правды — «в заявке отказался»
// и «в чате нажал принять», — и рано или поздно они разошлись бы. Поэтому `state()` каждый раз
// читает сущность, а `apply()` пишет в неё же.

export type { ActionState, ChatAction };

type Handler = {
  /** Подпись над кнопками — о чём спрашиваем. */
  title: string;
  /** Текущее состояние выбора по данным сущности. */
  state: (payload: Payload, accountId: number) => Promise<ActionState>;
  /** Записать выбор. Возвращает текст претензии либо null. */
  apply: (payload: Payload, accountId: number, choice: string) => Promise<string | null>;
};

type Payload = Record<string, unknown>;

const num = (payload: Payload, key: string): number | null => {
  const v = payload[key];
  return typeof v === "number" && Number.isInteger(v) ? v : null;
};

/** Профиль игрока за аккаунтом — им подписан ответ, и им же проверяется «а его ли это выбор». */
async function playerOf(accountId: number): Promise<number | null> {
  const account = await prisma.userAccount.findUnique({ where: { id: accountId }, select: { playerId: true } });
  return account?.playerId ?? null;
}

const ROSTER_INVITE: Handler = {
  title: "Идёте за эту команду?",

  state: async (payload) => {
    const id = num(payload, "memberId");
    const row = id
      ? await prisma.teamApplicationMember.findUnique({
          where: { id },
          include: { application: { select: { status: true } } },
        })
      : null;

    if (!row) return { open: false, note: "Приглашение больше не действует." };
    if (row.status === "accepted") return { open: false, note: "Вы подтвердили участие." };
    if (row.status === "declined") return { open: false, note: "Вы отказались от участия." };
    // Заявку вернули или сняли — вопрос «идёшь ли ты» вместе с ней потерял смысл.
    if (row.application.status !== "pending" && row.application.status !== "approved") {
      return { open: false, note: "Заявку команды сняли — отвечать больше не нужно." };
    }
    return {
      open: true,
      options: [
        { key: "accepted", label: "Иду", tone: "accent" },
        { key: "declined", label: "Не иду", tone: "quiet" },
      ],
    };
  },

  apply: async (payload, accountId, choice) => {
    if (choice !== "accepted" && choice !== "declined") return "Не разобрал ответ";
    const id = num(payload, "memberId");
    if (!id) return "Приглашение не найдено";
    const playerId = await playerOf(accountId);
    if (!playerId) return "Профиль не привязан";
    return respondToInvite(playerId, id, choice);
  },
};

const HANDLERS: Record<string, Handler> = {
  "roster-invite": ROSTER_INVITE,
};

export const isActionKind = (kind: string): boolean => kind in HANDLERS;

/** Данные действия из строки сообщения. Битый JSON — не повод падать лентой: выбора просто нет. */
export function parsePayload(raw: string | null | undefined): Payload {
  if (!raw) return {};
  try {
    const data: unknown = JSON.parse(raw);
    return data && typeof data === "object" ? (data as Payload) : {};
  } catch {
    return {};
  }
}

export const formatPayload = (payload: Payload): string => JSON.stringify(payload);

/** Действие сообщения в том виде, в каком его рисует лента. Незнакомый вид — просто текст. */
export async function actionOf(
  kind: string | null,
  payload: string | null,
  accountId: number,
): Promise<ChatAction | null> {
  if (!kind) return null;
  const handler = HANDLERS[kind];
  if (!handler) return null;
  const state = await handler.state(parsePayload(payload), accountId);
  return { kind, title: handler.title, ...state };
}

/**
 * Нажали кнопку. Право проверяется дважды: сообщение должно лежать в беседе этого человека
 * (иначе чужим id можно было бы ответить за другого), и сам обработчик сверяет сущность.
 */
export async function applyAction(messageId: number, accountId: number, choice: string): Promise<string | null> {
  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { kind: true, payload: true, conversationId: true },
  });
  if (!message?.kind) return "Это сообщение без выбора";

  const mine = await prisma.conversationMember.findUnique({
    where: { conversationId_accountId: { conversationId: message.conversationId, accountId } },
    select: { id: true },
  });
  if (!mine) return "Это не ваша беседа";

  const handler = HANDLERS[message.kind];
  if (!handler) return "Такой выбор больше не поддерживается";
  return handler.apply(parsePayload(message.payload), accountId, choice);
}
