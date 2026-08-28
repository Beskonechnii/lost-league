// Только сервер / скрипт: очередь предложений времени встречи — что капитан заказал в боте и что
// с этим стало. Тексты и отправка живут в `tg-meetings.ts`, здесь только модель: кто кому что
// предложил, кто ответил и когда это попало в расписание.
//
// **Время пишет не капитан, а организатор.** Договорённость двух капитанов остаётся перепиской,
// пока её не подтвердил оператор: `Series.startAt` меняет только апрув (`approveProposal`). То же
// правило, что у заявки команды и правки профиля — бот сам ничего не публикует.
//
// **Соперника выбирает не человек, а расписание.** Капитану показываются его же несыгранные серии
// (`openSeriesFor`), а не список команд лиги: ошибиться в сопернике не должно быть возможности.
//
// **Сторона выводится из состава, а не хранится.** Чья команда прислала предложение — читается из
// места капитана в дивизионе встречи (`RosterSpot`). Поле «команда-отправитель» разъехалось бы с
// ростером при пересборке состава, а место в составе — та же истина, по которой человек вообще
// имеет право заказывать встречу.
//
// Без `server-only`: модуль зовёт бот (обычный node, `scripts/bot.ts`) — как `profile-edit.ts` и
// `tg-login.ts`. Права оператора проверяет вызывающий (server-action страницы архива).

import { prisma } from "./prisma";

/** Состояние предложения. Оно же лежит в `MatchRequest.status`. */
export type RequestStatus = "pending_opponent" | "pending_admin" | "approved" | "declined" | "expired";

/** Живые состояния — те, по которым ещё кто-то должен ответить. */
export const OPEN_STATUSES: RequestStatus[] = ["pending_opponent", "pending_admin"];

// ── кто это ──────────────────────────────────────────────────────────────────

/**
 * Профиль по привязке `UserAccount.tgId`. Только по ней: заказ встречи — действие, которое пишет,
 * а хендл не удостоверение (то же правило, что у правки профиля в `tg-profile.ts`).
 */
export async function linkedPlayerId(tgId: string | null | undefined): Promise<number | null> {
  if (!tgId) return null;
  const account = await prisma.userAccount.findUnique({ where: { tgId }, select: { playerId: true } });
  return account?.playerId ?? null;
}

const captainSpotInclude = {
  team: { select: { id: true, name: true } },
  division: { select: { id: true, name: true, tournament: { select: { name: true, slug: true } } } },
} as const;

export type CaptainSpot = {
  teamId: number;
  teamName: string;
  divisionId: number;
  divisionName: string;
  tournamentName: string;
  tournamentSlug: string;
};

/**
 * Где человек капитан прямо сейчас. Турниры берём идущие и принимающие заявки: у черновика ещё нет
 * сетки, а у сыгранного нечего назначать. Мест может быть несколько — капитан в D1 и играющий
 * тренер в D2 это разные команды.
 */
export async function captainSpots(playerId: number, tournamentId?: number): Promise<CaptainSpot[]> {
  const spots = await prisma.rosterSpot.findMany({
    where: {
      playerId,
      isCaptain: true,
      division: {
        ...(tournamentId ? { tournamentId } : {}),
        tournament: { status: { in: ["registration", "running"] } },
      },
    },
    include: captainSpotInclude,
    orderBy: { divisionId: "desc" },
  });
  return spots
    .filter((s) => s.division)
    .map((s) => ({
      teamId: s.team.id,
      teamName: s.team.name,
      divisionId: s.division!.id,
      divisionName: s.division!.name,
      tournamentName: s.division!.tournament.name,
      tournamentSlug: s.division!.tournament.slug,
    }));
}

/** Капитаны команды в этом дивизионе. Их может не быть вовсе — тогда писать некому. */
export async function captainsOf(teamId: number, divisionId: number | null): Promise<number[]> {
  const spots = await prisma.rosterSpot.findMany({
    where: { teamId, divisionId, isCaptain: true },
    select: { playerId: true },
  });
  return spots.map((s) => s.playerId);
}

// ── встречи капитана ─────────────────────────────────────────────────────────

const seriesInclude = {
  home: { select: { id: true, name: true } },
  away: { select: { id: true, name: true } },
  divisionRef: { select: { id: true, name: true, tournament: { select: { name: true, slug: true } } } },
} as const;

export type MeetingSeries = Awaited<ReturnType<typeof loadSeries>>;

const loadSeries = (id: number) => prisma.series.findUnique({ where: { id }, include: seriesInclude });

/**
 * Несыгранные встречи команд, где человек капитан. Уже назначенные тоже здесь: заказ времени у
 * встречи со временем — это перенос, и запрещать его значило бы гнать капитанов обратно в личку
 * организатора.
 */
export async function openSeriesFor(spots: CaptainSpot[]) {
  if (spots.length === 0) return [];
  const rows = await prisma.series.findMany({
    where: {
      playedAt: null,
      OR: spots.map((s) => ({ divisionId: s.divisionId, OR: [{ homeId: s.teamId }, { awayId: s.teamId }] })),
    },
    include: seriesInclude,
    orderBy: [{ startAt: "asc" }, { id: "asc" }],
  });
  // Чья сторона — знает вызывающий: он же рисует «мы — соперник», а не «хозяева — гости».
  return rows.map((series) => {
    const mine = spots.find((s) => s.teamId === series.homeId || s.teamId === series.awayId)!;
    const opponent = series.homeId === mine.teamId ? series.away : series.home;
    return { series, spot: mine, opponent };
  });
}

// ── стороны предложения ──────────────────────────────────────────────────────

const requestInclude = {
  series: { include: seriesInclude },
  proposedBy: { select: { id: true, nickname: true } },
} as const;

export type MatchRequestRow = NonNullable<Awaited<ReturnType<typeof loadRequest>>>;

export const loadRequest = (id: number) => prisma.matchRequest.findUnique({ where: { id }, include: requestInclude });

/**
 * Команда предложившего — по его месту в составе дивизиона встречи. `null` значит, что капитана из
 * состава уже убрали: такое предложение никому не адресовано и доживёт до `expired`.
 */
export async function proposerTeamId(request: MatchRequestRow): Promise<number | null> {
  const spot = await prisma.rosterSpot.findFirst({
    where: {
      playerId: request.proposedByPlayerId,
      divisionId: request.series.divisionId,
      teamId: { in: [request.series.homeId, request.series.awayId] },
    },
    select: { teamId: true },
  });
  return spot?.teamId ?? null;
}

/** Кому предложение адресовано: вторая команда встречи. */
export async function opponentTeamId(request: MatchRequestRow): Promise<number | null> {
  const from = await proposerTeamId(request);
  if (from === null) return null;
  return from === request.series.homeId ? request.series.awayId : request.series.homeId;
}

// ── создание ─────────────────────────────────────────────────────────────────

/**
 * Закрыть остальные живые предложения по встрече. Одно живое на встречу: два открытых предложения
 * на разное время означали бы, что подтверждённым окажется то, которое организатор случайно
 * открыл первым.
 */
async function supersede(seriesId: number, exceptId: number, reason: string): Promise<void> {
  await prisma.matchRequest.updateMany({
    where: { seriesId, status: { in: OPEN_STATUSES }, id: { not: exceptId } },
    data: { status: "declined", declineReason: reason, opponentDecidedAt: new Date() },
  });
}

export type ProposalInput = {
  seriesId: number;
  playerId: number;
  startAt: Date;
  /** Исходное предложение, на которое это — встречное. */
  parentId?: number | null;
};

/**
 * Завести предложение. Проверки те же, что показывал диалог, но здесь они окончательны: между
 * первой кнопкой и подтверждением проходят минуты, за которые встречу успевают сыграть, а капитана —
 * снять с состава.
 */
export async function createProposal(input: ProposalInput): Promise<{ error: string } | { id: number }> {
  const series = await loadSeries(input.seriesId);
  if (!series) return { error: "Встречи больше нет — возможно, её убрали из сетки." };
  if (series.playedAt) return { error: "Эта встреча уже сыграна." };
  if (input.startAt.getTime() <= Date.now()) return { error: "Это время уже прошло — выберите другое." };

  const spots = await captainSpots(input.playerId);
  const mine = spots.find(
    (s) => s.divisionId === series.divisionId && (s.teamId === series.homeId || s.teamId === series.awayId),
  );
  if (!mine) return { error: "Вы больше не капитан этой команды — заказать встречу не выйдет." };

  const created = await prisma.matchRequest.create({
    data: {
      seriesId: series.id,
      proposedByPlayerId: input.playerId,
      proposedStartAt: input.startAt,
      status: "pending_opponent",
      parentId: input.parentId ?? null,
    },
  });
  await supersede(series.id, created.id, "предложено другое время");
  return { id: created.id };
}

// ── ответы ───────────────────────────────────────────────────────────────────

/**
 * Живые предложения, адресованные этому капитану: по встречам его команд и **не** от своей же
 * стороны. Свежие сверху — на кнопку «Принять» отвечает последнее пришедшее.
 */
export async function proposalsForCaptain(playerId: number): Promise<MatchRequestRow[]> {
  const spots = await captainSpots(playerId);
  if (spots.length === 0) return [];

  const rows = await prisma.matchRequest.findMany({
    where: {
      status: "pending_opponent",
      series: {
        OR: spots.map((s) => ({ divisionId: s.divisionId, OR: [{ homeId: s.teamId }, { awayId: s.teamId }] })),
      },
    },
    include: requestInclude,
    orderBy: { id: "desc" },
  });

  const mine: MatchRequestRow[] = [];
  for (const row of rows) {
    const to = await opponentTeamId(row);
    if (to !== null && spots.some((s) => s.teamId === to && s.divisionId === row.series.divisionId)) mine.push(row);
  }
  return mine;
}

/** Соперник принял — дальше слово за организатором. */
export async function acceptProposal(id: number): Promise<void> {
  await prisma.matchRequest.updateMany({
    where: { id, status: "pending_opponent" },
    data: { status: "pending_admin", opponentDecidedAt: new Date() },
  });
}

/** Отказ: и встречное предложение (там причина «предложено другое время»), и отказ организатора. */
export async function declineProposal(id: number, reason: string, byAdmin = false): Promise<void> {
  await prisma.matchRequest.updateMany({
    where: { id, status: { in: OPEN_STATUSES } },
    data: {
      status: "declined",
      declineReason: reason,
      ...(byAdmin ? { adminDecidedAt: new Date() } : { opponentDecidedAt: new Date() }),
    },
  });
}

/**
 * Апрув организатора — единственное место, где предложение становится расписанием. Возвращает
 * прежнее время встречи: по нему рассылка (`announceReschedule`) отличает «назначили» от
 * «перенесли». `error` — предложение успело закрыться, пока страница висела открытой.
 */
export async function approveProposal(id: number): Promise<{ error: string } | { seriesId: number; before: Date | null }> {
  const request = await loadRequest(id);
  if (!request) return { error: "Предложения больше нет." };
  if (request.status !== "pending_admin") return { error: "Предложение уже не ждёт подтверждения." };
  if (request.series.playedAt) return { error: "Встреча уже сыграна." };

  const before = request.series.startAt;
  await prisma.series.update({ where: { id: request.seriesId }, data: { startAt: request.proposedStartAt } });
  await prisma.matchRequest.update({
    where: { id },
    data: { status: "approved", adminDecidedAt: new Date() },
  });
  await supersede(request.seriesId, id, "организатор подтвердил другое время");
  return { seriesId: request.seriesId, before };
}

// ── очередь организатора ─────────────────────────────────────────────────────

/** Согласованные капитанами предложения, ждущие подтверждения. Старые сверху — их дольше ждут. */
export function pendingForAdmin(divisionIds: number[]): Promise<MatchRequestRow[]> {
  if (divisionIds.length === 0) return Promise.resolve([]);
  return prisma.matchRequest.findMany({
    where: { status: "pending_admin", series: { divisionId: { in: divisionIds } } },
    include: requestInclude,
    orderBy: { id: "asc" },
  });
}

/**
 * То же для экрана: с именем команды, которая предложила время. Сторону выводим здесь, а не в
 * разметке, — это тот же вывод из состава, что и у бота, и второй его копии быть не должно.
 */
export async function pendingForAdminView(divisionIds: number[]) {
  const rows = await pendingForAdmin(divisionIds);
  return Promise.all(
    rows.map(async (r) => {
      const from = await proposerTeamId(r);
      return {
        row: r,
        fromTeamName:
          from === r.series.homeId ? r.series.home.name : from === r.series.awayId ? r.series.away.name : null,
      };
    }),
  );
}

// ── просрочка ────────────────────────────────────────────────────────────────

/**
 * Предложения, чьё время уже прошло. Отвечать на «сыграем вчера в 20:00» некому и незачем: такие
 * закрываем молча — капитан и так видит, что время прошло, а сообщение «ваше предложение истекло»
 * посреди ночи полезнее не делает. Зовётся тиком расписания (`tg-schedule.ts`).
 */
export async function expireStaleRequests(now: Date = new Date()): Promise<number> {
  const { count } = await prisma.matchRequest.updateMany({
    where: { status: { in: OPEN_STATUSES }, proposedStartAt: { lt: now } },
    data: { status: "expired" },
  });
  return count;
}
