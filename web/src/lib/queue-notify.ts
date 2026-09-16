import "server-only";
import { prisma } from "./prisma";
import { effectiveRole, ownerEmails } from "./account";
import { hasPermission } from "./permissions";
import { tellAccount } from "./system-chat";
import type { PermissionKey } from "./permissions";

// Уведомления ОПЕРАТОРУ: событие очереди приходит строкой в колокольчик тем, у кого есть право
// этой очереди. Канал тот же самый — беседа с лигой (`system-chat.ts`), новым стал только адресат
// (решение 04.09.2026 не нарушено: второго списка сообщений работа не заводит).
//
// Почему реестром, а не по месту. Одно событие живёт в трёх местах сразу: право адресата нужно
// отправке, значок и адрес — строке в панели (`app/_components/app-shell.tsx`). Разложенные по
// месту, они разъехались бы на первой правке — строка про заявку команды открывала бы вкладку
// анкет. Ключ реестра ложится в `ChatMessage.kind`, то же поле, что у сообщений с выбором
// (`chat-actions.ts`): неизвестный ему kind даёт там `null`, кнопок у строки не появляется.
//
// Отправка не роняет действие, которое её породила: анкета сохраняется, даже если писать некому
// или некуда (тот же уговор, что у `tg-notify.ts` и `tellAccount`).
//
// **Бот сюда не достаёт.** Модуль `server-only` — как и весь системный канал: живой канал держит
// соединения в памяти процесса приложения, а бот (`scripts/bot.ts`) — отдельный node-процесс.
// Анкета и правка профиля, присланные из телеграма, очередь пополняют, но строки не дают.

/** Адрес вкладки, где событие разбирают, и чем оно помечено в панели. Значки — из `pouf/Icon.tsx`. */
export const QUEUE_NOTICES = {
  "queue.profiles": { permission: "accounts.approve", icon: "user", href: "/admin/moderation" },
  "queue.links": { permission: "accounts.approve", icon: "users", href: "/admin/moderation?tab=links" },
  "queue.teams": { permission: "accounts.approve", icon: "trophy", href: "/admin/moderation?tab=teams" },
  "queue.edits": { permission: "roster.edit", icon: "draft", href: "/admin/moderation?tab=edits" },
} as const satisfies Record<string, { permission: PermissionKey; icon: string; href: string }>;

export type QueueKind = keyof typeof QUEUE_NOTICES;

/** Вид строки по её `kind`. Не операторская строка — `null`, и рисуется она как прежде. */
export const queueNotice = (kind: string | null | undefined) =>
  kind && kind in QUEUE_NOTICES ? QUEUE_NOTICES[kind as QueueKind] : null;

/**
 * Написать всем, у кого есть право этой очереди. Право берётся из реестра (`permissions.ts`), а не
 * перечислением ролей по месту: выдали `accounts.approve` новому админу — он начал получать строки
 * сам, без правки этого файла.
 *
 * `byAccountId` — тот, кто совершил действие: сам себе лига не пишет.
 */
async function tellOperators(kind: QueueKind, text: string, byAccountId: number | null): Promise<void> {
  try {
    const { permission } = QUEUE_NOTICES[kind];
    const staff = await prisma.userAccount.findMany({
      // Владелец лиги может стоять в базе кем угодно — его роль задаёт OWNER_EMAIL, поэтому почта
      // во втором условии, а не только колонка роли.
      where: { status: "active", OR: [{ role: { in: ["owner", "admin"] } }, { email: { in: ownerEmails() } }] },
      select: { id: true, email: true, role: true, permissions: true },
    });
    for (const a of staff) {
      if (a.id === byAccountId) continue;
      // Роль считаем `effectiveRole`: владелец лиги узнаётся по почте из OWNER_EMAIL, а в колонке
      // роли у него может стоять что угодно.
      if (!hasPermission(effectiveRole(a), a.permissions, permission)) continue;
      await tellAccount(a.id, text, { kind, payload: {} });
    }
  } catch (e) {
    console.error("Не удалось разослать уведомление оператору:", e);
  }
}

/** Пришла анкета новичка. */
export const noticeNewProfile = (nickname: string, byAccountId: number) =>
  tellOperators("queue.profiles", `Анкета от ${nickname}`, byAccountId);

/** Пришла заявка на привязку к профилю. Ник берём из ростера: в анкете он со слов подавшего. */
export async function noticeProfileClaim(playerId: number, byAccountId: number): Promise<void> {
  const player = await prisma.player.findUnique({ where: { id: playerId }, select: { nickname: true } });
  await tellOperators("queue.links", `Заявка на привязку к профилю ${player?.nickname ?? "игрока"}`, byAccountId);
}

/** Пришла заявка команды в турнир. */
export const noticeTeamApplication = (team: string, tournament: string, byAccountId: number) =>
  tellOperators("queue.teams", `Заявка команды «${team}» в ${tournament}`, byAccountId);

/** Игрок прислал правку профиля. Полей может быть несколько — это одно событие, а не три. */
export const noticeProfileEdit = (nickname: string, fields: string[], byAccountId: number) =>
  tellOperators("queue.edits", `Правка профиля от ${nickname}: ${fields.join(", ")}`, byAccountId);
