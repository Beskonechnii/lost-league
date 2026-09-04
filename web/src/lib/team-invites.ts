// Только сервер / скрипт: согласие игроков на заявку команды.
//
// Ступени идут ПАРАЛЛЕЛЬНО (решение 04.09.2026, DECISIONS): заявка капитана уходит организатору
// сразу, а рядом с ней собираются ответы тех, кого капитан вписал в состав. Ответ игрока ничего
// не блокирует — он информирует: оператор видит в очереди, кто подтвердил, а кто отказался, и
// решает сам. Иначе одна неотвеченная строка морозила бы всю заявку до дедлайна.
//
// Строки живут отдельной таблицей, а не в payload: payload капитан перезаписывает при каждой
// правке состава, и ответы стирались бы вместе с ним. Ключ строки — ник: он же ключ состава
// в заявке, и по нему ответ переживает переотправку.
//
// Без `server-only`: модуль зовёт и бот (`submitTelegramApplication` идёт из процесса бота),
// как `team-application.ts` и `profile-edit.ts`.

import { prisma } from "./prisma";
import type { TeamDraft } from "./roster-import";

export type InviteStatus = "invited" | "accepted" | "declined";

export const INVITE_LABEL: Record<InviteStatus, string> = {
  invited: "позван",
  accepted: "принял",
  declined: "отказался",
};

/** Тон пилюли Кита под статус: отказ — предупреждение, согласие — успех, ожидание — нейтраль. */
export const INVITE_TONE: Record<InviteStatus, "ok" | "warn" | "neutral"> = {
  invited: "neutral",
  accepted: "ok",
  declined: "warn",
};

export const isInviteStatus = (v: string): v is InviteStatus =>
  v === "invited" || v === "accepted" || v === "declined";

/**
 * Опознать игроков состава в ростере. Сначала по `account_id` — это единственный ключ, который
 * не зависит от того, как человек назвался в заявке; ник берём запасным ходом и сравниваем без
 * регистра. Не опознался — значит, в лиге его ещё нет: спрашивать некого, апрув заведёт профиль.
 */
async function matchPlayers(draft: TeamDraft): Promise<Map<string, number>> {
  const accountIds = draft.players.map((p) => p.accountId).filter((v): v is string => !!v);

  const byAccount = accountIds.length
    ? await prisma.player.findMany({ where: { accountId: { in: accountIds } }, select: { id: true, accountId: true } })
    : [];
  // Ники сверяем в памяти: sqlite через Prisma не умеет `mode: "insensitive"`, а игроков в лиге
  // столько же, сколько людей, — не выборка, ради которой стоит городить SQL.
  const known = await prisma.player.findMany({ select: { id: true, nickname: true } });
  const byNickname = new Map(known.map((p) => [p.nickname.trim().toLowerCase(), p.id]));
  const byAccountId = new Map(byAccount.map((p) => [p.accountId!, p.id]));

  const found = new Map<string, number>();
  for (const p of draft.players) {
    const nick = p.nickname.trim();
    if (!nick) continue;
    const id = (p.accountId ? byAccountId.get(p.accountId) : undefined) ?? byNickname.get(nick.toLowerCase());
    if (id) found.set(nick, id);
  }
  return found;
}

/**
 * Привести список позванных в соответствие с составом заявки. Возвращает строки, заведённые
 * ИМЕННО СЕЙЧАС, — их и надо уведомить: звать заново тех, кто уже ответил, при каждой правке
 * заявки капитаном значит превратить уведомление в спам.
 *
 * Ответы прежних участников сохраняются: строка привязана к нику, а ник в составе тот же.
 * Кого капитан из состава убрал — того убираем и отсюда: он в этой заявке больше не значится.
 */
export async function syncApplicationMembers(applicationId: number, draft: TeamDraft) {
  const nicknames = draft.players.map((p) => p.nickname.trim()).filter(Boolean);
  const players = await matchPlayers(draft);
  const existing = await prisma.teamApplicationMember.findMany({ where: { applicationId } });
  const known = new Set(existing.map((m) => m.nickname));

  // Пустой `notIn` sqlite не любит, поэтому пустой состав чистим отдельной веткой.
  if (nicknames.length) {
    await prisma.teamApplicationMember.deleteMany({ where: { applicationId, nickname: { notIn: nicknames } } });
  } else {
    await prisma.teamApplicationMember.deleteMany({ where: { applicationId } });
  }

  // Игрока могли опознать позже, чем позвали (завёлся профиль, дописали account_id) — привязку
  // обновляем и у прежних строк, иначе приглашение так и не доедет до его кабинета.
  for (const m of existing) {
    const playerId = players.get(m.nickname) ?? null;
    if (nicknames.includes(m.nickname) && playerId !== m.playerId) {
      await prisma.teamApplicationMember.update({ where: { id: m.id }, data: { playerId } });
    }
  }

  const fresh = nicknames.filter((n) => !known.has(n));
  if (!fresh.length) return [];

  await prisma.teamApplicationMember.createMany({
    data: fresh.map((nickname) => ({ applicationId, nickname, playerId: players.get(nickname) ?? null })),
  });

  return prisma.teamApplicationMember.findMany({
    where: { applicationId, nickname: { in: fresh } },
    include: { application: { include: { tournament: true } } },
  });
}

/** Позванные по заявке — оператору в очередь: кто подтвердил, а кто отказался. */
export const applicationMembers = (applicationId: number) =>
  prisma.teamApplicationMember.findMany({ where: { applicationId }, orderBy: { id: "asc" } });

export type InviteRow = Awaited<ReturnType<typeof applicationMembers>>[number];

/** Позванные сразу по нескольким заявкам — чтобы список очереди не делал запрос на строку. */
export async function membersByApplication(applicationIds: number[]): Promise<Map<number, InviteRow[]>> {
  const map = new Map<number, InviteRow[]>();
  if (!applicationIds.length) return map;
  const rows = await prisma.teamApplicationMember.findMany({
    where: { applicationId: { in: applicationIds } },
    orderBy: { id: "asc" },
  });
  for (const r of rows) map.set(r.applicationId, [...(map.get(r.applicationId) ?? []), r]);
  return map;
}

/**
 * Приглашения игрока, на которые он ещё не ответил. Отклонённые заявки не показываем: команда
 * с ними на турнир уже не идёт, и вопрос «идёшь ли ты» потерял смысл.
 */
export const openInvites = (playerId: number) =>
  prisma.teamApplicationMember.findMany({
    where: { playerId, status: "invited", application: { status: { in: ["pending", "approved"] } } },
    orderBy: { invitedAt: "asc" },
    include: { application: { include: { tournament: true, division: true } } },
  });

export type OpenInvite = Awaited<ReturnType<typeof openInvites>>[number];

/**
 * Ответ игрока. Идентичность проверяем здесь: `playerId` приходит из сессии, а id строки — из
 * формы, и без сверки чужим приглашением можно было бы ответить за другого.
 */
export async function respondToInvite(
  playerId: number,
  memberId: number,
  answer: "accepted" | "declined",
): Promise<string | null> {
  const row = await prisma.teamApplicationMember.findUnique({ where: { id: memberId } });
  if (!row || row.playerId !== playerId) return "Приглашение не найдено";
  if (row.status !== "invited") return "Вы уже ответили на это приглашение";
  await prisma.teamApplicationMember.update({
    where: { id: memberId },
    data: { status: answer, respondedAt: new Date() },
  });
  return null;
}
