import "server-only";
import type { LiveEvent } from "./chat-events";

export type { ChatEventMessage, LiveEvent } from "./chat-events";

// Кто сейчас на сайте и как до него дозвониться. Живёт в памяти процесса, а не в БД, — и это
// осознанно: присутствие истинно только «сейчас», после перезапуска его нужно не восстановить,
// а забыть. Приложение — один постоянный процесс Node (DEPLOY.md), поэтому память процесса и есть
// полная картина; если когда-нибудь нод станет несколько, сюда встанет Redis-pub/sub, а внешний
// договор (этот файл) не поменяется.
//
// Одно соединение = одна открытая вкладка (SSE-поток /api/chat/stream). Отсюда два следствия:
// закрыл вкладку — ушёл из онлайна без всяких таймаутов; и по этому же каналу человеку прилетают
// его личные события (новое сообщение, прочтение), потому что канал уже открыт и второй не нужен.

type Client = {
  accountId: number;
  /** Профиль игрока, если аккаунт привязан: точки онлайна рисуются по игрокам, а не по аккаунтам. */
  playerId: number | null;
  send: (event: LiveEvent) => void;
};

// HMR в dev перезагружает модуль, а соединения при этом живы — реестр держим на globalThis,
// иначе после первой же правки половина клиентов «исчезает» из онлайна.
const g = globalThis as unknown as { lostPresence?: Set<Client> };
const clients: Set<Client> = (g.lostPresence ??= new Set());

/** Регистрирует соединение и возвращает функцию отключения. */
export function connect(client: Client): () => void {
  clients.add(client);
  broadcastPresence();
  return () => {
    clients.delete(client);
    broadcastPresence();
  };
}

/** Игроки, кто сейчас в сети (только привязанные к профилю аккаунты, без повторов). */
export function onlinePlayerIds(): number[] {
  const ids = new Set<number>();
  for (const c of clients) if (c.playerId) ids.add(c.playerId);
  return [...ids];
}

/** Сколько человек на сайте: считаем аккаунты, а не вкладки — три вкладки это один человек. */
export function onlineCount(): number {
  const ids = new Set<number>();
  for (const c of clients) ids.add(c.accountId);
  return ids.size;
}

/** В сети ли аккаунт — по нему решается, слать ли уведомление в телеграм вместо экрана. */
export function isOnline(accountId: number): boolean {
  for (const c of clients) if (c.accountId === accountId) return true;
  return false;
}

/** Личное событие аккаунту — во все его открытые вкладки. */
export function pushTo(accountId: number, event: LiveEvent): void {
  for (const c of clients) if (c.accountId === accountId) c.send(event);
}

/** Снимок присутствия — всем. Зовётся при подключении и отключении, других поводов нет. */
function broadcastPresence(): void {
  const event: LiveEvent = { type: "presence", players: onlinePlayerIds(), count: onlineCount() };
  for (const c of clients) c.send(event);
}
