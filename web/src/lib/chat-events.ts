// Форма событий живого канала — общая для сервера (кто их шлёт) и клиента (кто их слушает).
// Отдельным файлом ровно поэтому: presence.ts помечен server-only, из клиента его не импортировать
// даже типом, а типы должны быть одни на оба конца провода.

import type { LobbyLine, LobbyRoom } from "./lobby-room";

/** Что человек видит вместо кнопок, когда выбор сделан или потерял смысл. */
export type ActionState =
  | {
      open: true;
      /** `href` — кнопка НИКУДА не пишет, а ведёт на страницу (приглашение в лобби): вход в
       *  комнату это переход, а не ответ, и записывать в сущность здесь нечего. */
      options: { key: string; label: string; tone: "accent" | "quiet"; href?: string }[];
    }
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
  /** Комната встречи изменилась — снимок целиком (src/lib/lobby.ts). Один на всех участников:
   *  «моё ли это» клиент считает сам по своему accountId. */
  | { type: "lobby"; room: LobbyRoom }
  /** Реплика в чате комнаты — тем же каналом, что и всё остальное живое (ТЗ 22в §2).
   *  Второго механизма переписки не появляется: это событие, а не свой поток. */
  | { type: "lobby-chat"; lobbyId: number; line: LobbyLine }
  /** Комнату удалили (ТЗ 42ж §1). Снимка больше нет — вкладке остаётся уйти на список комнат. */
  | { type: "lobby-gone"; lobbyId: number }
  | { type: "message"; conversationId: number; peerPlayerId: number | null; message: ChatEventMessage }
  | { type: "read"; conversationId: number; at: string }
  | { type: "ping" };
