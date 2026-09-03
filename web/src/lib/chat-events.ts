// Форма событий живого канала — общая для сервера (кто их шлёт) и клиента (кто их слушает).
// Отдельным файлом ровно поэтому: presence.ts помечен server-only, из клиента его не импортировать
// даже типом, а типы должны быть одни на оба конца провода.

export type ChatEventMessage = {
  id: number;
  text: string;
  createdAt: string;
  senderAccountId: number;
  /** Моё ли сообщение — решает сервер для каждого получателя отдельно. */
  mine: boolean;
};

export type LiveEvent =
  | { type: "presence"; players: number[]; count: number }
  | { type: "message"; conversationId: number; peerPlayerId: number | null; message: ChatEventMessage }
  | { type: "read"; conversationId: number; at: string }
  | { type: "ping" };
