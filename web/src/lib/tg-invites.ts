// Только сервер / скрипт: ответ на приглашение в состав прямо в боте.
//
// Пара к `/me/invites` на сайте. Уведомление о том, что капитан вписал человека в заявку, шлёт
// `tg-notify.ts` — и вместе с текстом ставит клавиатуру «Иду / Не иду». Нажатие приходит вне
// разговора (человек мог стоять где угодно, хоть неделю назад), поэтому подписи кнопок объявлены
// ТОЧКОЙ ВХОДА своего флоу, а не кнопками экрана — ровно как ответ сопернику (`tg-meetings.ts`).
//
// Отвечать даём только по настоящей привязке `UserAccount.tgId`: узнанному по хендлу — нет.
// Хендл человек меняет, освободившийся может занять посторонний, и тогда чужой отказался бы за
// игрока от турнира. То же правило, что у правки профиля (`tg-profile.ts`) и заказа встречи.
//
// Форма модуля — контракт ноды `subflow` (`bot-flow/subflows.ts`): `startX/handleX → { replies,
// step, state, done }`.

import { prisma } from "./prisma";
import type { Reply } from "./telegram";
import { parseDraft } from "./team-application";
import { openInvites, respondToInvite } from "./team-invites";

export const INVITE_YES = "Иду";
export const INVITE_NO = "Не иду";

/** Шаг ответа. Живёт в общей `BotSession.step` под своим префиксом, как `reg_*` и `mr_*`. */
export type InvStep = "inv_pick";

export const isInvStep = (step: string): step is InvStep => step.startsWith("inv_");

/**
 * Что уже известно: ответ выбран кнопкой уведомления, осталось понять, к какой заявке он относится.
 * Список команд держим в состоянии, а не перезапрашиваем: повтор вопроса (`askInvite`) граф зовёт
 * без чата и tgId — у него на руках только шаг и состояние модуля.
 */
export type InvState = { answer: "accepted" | "declined" | null; teams: string[] };

export const emptyInvite = (): InvState => ({ answer: null, teams: [] });

export type InvResult = { replies: Reply[]; step?: InvStep; state: InvState; done?: boolean };

const done = (text: string): InvResult => ({ replies: [{ text }], state: emptyInvite(), done: true });

/** Профиль, за который человек вправе отвечать: только по привязке (см. шапку). */
async function linkedPlayerId(tgId: string | null | undefined): Promise<number | null> {
  if (!tgId) return null;
  const account = await prisma.userAccount.findUnique({ where: { tgId }, select: { playerId: true } });
  return account?.playerId ?? null;
}

/** Название команды из заявки — им человек и опознаёт, о каком приглашении речь. */
const teamName = (payload: string): string => parseDraft(payload)?.name ?? "команда";

/** Итог ответа словами — один текст на оба входа в модуль. */
const settled = (answer: "accepted" | "declined", team: string, tournament: string): string =>
  answer === "accepted"
    ? `Записал: вы идёте за <b>${team}</b> на «${tournament}». Организатор увидит это в заявке.`
    : `Записал отказ: <b>${team}</b>, «${tournament}». Капитану стоит написать — состав он собирает сам.`;

/**
 * Кнопка из уведомления. Открытых приглашений может быть несколько (человека зовут две команды),
 * поэтому одно закрываем сразу, а на несколько переспрашиваем — иначе «Иду» молча ушло бы не туда.
 */
export async function answerInvite(text: string, ctx: { tgId: string | null | undefined }): Promise<InvResult> {
  const answer: "accepted" | "declined" = text.trim() === INVITE_NO ? "declined" : "accepted";

  const playerId = await linkedPlayerId(ctx.tgId);
  if (!playerId) {
    return done(
      "Отвечать за игрока я даю только тому, кто заведён через меня, — так я точно знаю, что это вы. " +
        "Ответить можно на сайте: кабинет → «Приглашения».",
    );
  }

  const invites = await openInvites(playerId);
  if (invites.length === 0) return done("Открытых приглашений в состав у вас нет.");

  if (invites.length === 1) {
    const only = invites[0];
    const error = await respondToInvite(playerId, only.id, answer);
    if (error) return done(error);
    return done(settled(answer, teamName(only.application.payload), only.application.tournament.name));
  }

  const teams = invites.map((i) => teamName(i.application.payload));
  return { replies: [askPick(teams)], step: "inv_pick", state: { answer, teams } };
}

/** Вопрос «какая команда» — кнопками, чтобы название не пришлось набирать руками. */
function askPick(teams: string[]): Reply {
  return {
    text: "Вас позвали в несколько составов. Про какой ответ?",
    keyboard: teams.map((t) => [t]),
  };
}

/** Очередной ход: выбрана команда — записываем тот ответ, который человек нажал в уведомлении. */
export async function handleInvite(
  step: InvStep,
  state: InvState,
  text: string,
  ctx: { tgId: string | null | undefined },
): Promise<InvResult> {
  if (step !== "inv_pick") return done("Диалог потерялся по дороге — начнём сначала.");

  const playerId = await linkedPlayerId(ctx.tgId);
  if (!playerId) return done("Не вижу вашей привязки к профилю — начните заново с /start.");

  const invites = await openInvites(playerId);
  if (invites.length === 0) return done("Открытых приглашений в состав у вас нет.");

  const picked = invites.find((i) => teamName(i.application.payload).toLowerCase() === text.trim().toLowerCase());
  if (!picked) {
    const teams = invites.map((i) => teamName(i.application.payload));
    return {
      replies: [{ text: "Не разобрал команду — выберите кнопкой." }, askPick(teams)],
      step: "inv_pick",
      state: { ...state, teams },
    };
  }

  const answer = state.answer ?? "accepted";
  const error = await respondToInvite(playerId, picked.id, answer);
  if (error) return done(error);
  return done(settled(answer, teamName(picked.application.payload), picked.application.tournament.name));
}

/** Повторить вопрос, на котором стоит модуль (политика «повторить» у служебных кнопок). */
export function askInvite(step: InvStep, state: InvState): Reply | null {
  return step === "inv_pick" && state.teams.length ? askPick(state.teams) : null;
}
