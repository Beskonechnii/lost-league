import "server-only";

// Счётчик флуда — один на все переписки аккаунта: личка (chat.ts) и чат комнаты (lobby-chat.ts).
// Вынесен из chat.ts в ТЗ 22в: копия счётчика в лобби означала бы, что скрипт получает ДВА лимита
// вместо одного, а «сообщений в минуту» — свойство человека, а не того, куда он пишет.
//
// Живёт в памяти процесса, как и присутствие: окно — минута, после перезапуска забыть его можно
// без последствий. HMR в dev перезагружает модуль — реестр держим на globalThis, иначе правка
// файла обнуляла бы счётчики на ровном месте.

const WINDOW_MS = 60_000;
const LIMIT = 30; // сообщений в минуту с аккаунта: живому разговору хватает, скрипту — нет

const g = globalThis as unknown as { lostChatFlood?: Map<number, number[]> };
const flood: Map<number, number[]> = (g.lostChatFlood ??= new Map());

/** Отказ одной строкой, если аккаунт пишет слишком часто; null — можно. Засчитывает попытку. */
export function floodBlock(accountId: number): string | null {
  const now = Date.now();
  const recent = (flood.get(accountId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    flood.set(accountId, recent);
    return "Слишком часто — подождите минуту";
  }
  recent.push(now);
  flood.set(accountId, recent);
  return null;
}
