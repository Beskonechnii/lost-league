// Форма событий живого канала — общая для сервера (кто их шлёт) и клиента (кто их слушает).
// Отдельным файлом ровно поэтому: presence.ts помечен server-only, из клиента его не импортировать
// даже типом, а типы должны быть одни на оба конца провода.

/** Что человек видит вместо кнопок, когда выбор сделан или потерял смысл. */
export type ActionState =
  | { open: true; options: { key: string; label: string; tone: "accent" | "quiet" }[] }
  | { open: false; note: string };

/** Выбор в системном сообщении: реестр видов — `chat-actions.ts` (сервер), рисует его лента. */
export type ChatAction = { kind: string; title: string } & ActionState;

export type ChatEventMessage = {
  id: number;
  text: string;
  createdAt: string;
  senderAccountId: number;
  /** Моё ли сообщение — решает сервер для каждого получателя отдельно. */
  mine: boolean;
  /** Выбор, если сообщение системное. Считается для получателя, как и `mine`. */
  action?: ChatAction | null;
};

export type LiveEvent =
  | { type: "presence"; players: number[]; count: number }
  | { type: "message"; conversationId: number; peerPlayerId: number | null; message: ChatEventMessage }
  | { type: "read"; conversationId: number; at: string }
  | { type: "ping" };
