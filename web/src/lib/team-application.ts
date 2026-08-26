// Только сервер: заявки команд снаружи и запись состава в ростер.
//
// Два разных потока, но одно место записи. **Заявка** — то, что прислал человек со стороны (капитан
// с сайта, позже бот): состав лежит JSON'ом в `TeamApplication.payload`, а `Team`/`Player`/
// `RosterSpot` появляются только при одобрении — публичные витрины читают ростер без фильтров, и
// заявка от постороннего иначе сразу оказалась бы на /roster/teams. **Импорт** таблицы оператор
// пишет в ростер сразу, мимо очереди: подтверждать самому себе нечего.
//
// Пишет ростер одна функция — `writeTeamToRoster`; проверки перед записью тоже общие
// (`applicationProblems`: игрок уже действующий в другой команде дивизиона, один account_id под
// двумя никами, занятый слаг). Два пути записи разошлись бы правилами уже на второй правке.

import { prisma } from "./prisma";
import { slugify, playerAccountId } from "./profiles";
import { isCoreRole, spotConflict } from "./roster-spots";
import { registrationOpen, setTeamDivision } from "./tournaments";
import type { TeamDraft, PlayerDraft } from "./roster-import";

export type { TeamDraft, PlayerDraft };

/** Ответ на свой вопрос телеграм-бота. Вопрос хранится текстом, а не ключом: оператор его потом
 *  перепишет, а заявка прошлого месяца должна остаться читаемой. */
export type Answer = { question: string; answer: string };

/** JSON payload заявки. Версия — чтобы старую заявку можно было прочитать после смены формата. */
type Payload = { version: 1; team: TeamDraft; answers?: Answer[] };

export const formatDraft = (team: TeamDraft, answers: Answer[] = []): string =>
  JSON.stringify({ version: 1, team, ...(answers.length ? { answers } : {}) } satisfies Payload);

/** Битый payload — не повод падать всей очередью: заявка покажется пустой, оператор её вернёт. */
export function parseDraft(raw: string | null | undefined): TeamDraft | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Payload;
    return data?.team?.name ? data.team : null;
  } catch {
    return null;
  }
}

/** Ответы на свои вопросы бота. У заявок с сайта и из импорта их нет — пустой список. */
export function parseAnswers(raw: string | null | undefined): Answer[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as Payload;
    return Array.isArray(data?.answers) ? data.answers.filter((a) => a?.question && a?.answer) : [];
  } catch {
    return [];
  }
}

// ── очередь ──────────────────────────────────────────────────────────────────

export const listApplications = (tournamentId: number) =>
  prisma.teamApplication.findMany({
    where: { tournamentId },
    orderBy: [{ status: "asc" }, { submittedAt: "asc" }],
    include: { division: true, team: true },
  });

export type ApplicationRow = Awaited<ReturnType<typeof listApplications>>[number];

/**
 * Заявки команд, ждущие решения, по всем турнирам разом — для раздела модерации: он собирает всё,
 * что пришло снаружи, и очередь команд не должна жить только внутри карточки турнира.
 */
export const pendingApplications = () =>
  prisma.teamApplication.findMany({
    where: { status: "pending" },
    orderBy: { submittedAt: "asc" },
    include: { division: true, tournament: true },
  });

/**
 * Заявка капитана с сайта — единственный способ, которым состав попадает в очередь: импорт таблицы
 * оператор пишет в ростер сразу (подтверждать себе нечего). Здесь же проверяем на месте пустые поля
 * и слишком короткий состав, и запоминаем автора — по нему кабинет показывает статус.
 *
 * Приём заявок открыт только у турнира в статусе `registration` и до `regCloseAt` — проверяем
 * здесь, а не только в форме: до экшена можно дойти и мимо страницы.
 */
export async function submitTeamApplication(
  accountId: number,
  tournamentId: number,
  divisionId: number | null,
  draft: TeamDraft,
) {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw new Error("Турнир не найден");
  if (!registrationOpen(tournament)) throw new Error("Приём заявок на этот турнир закрыт");

  const name = draft.name.trim();
  if (!name) throw new Error("Укажите название команды");
  const players = draft.players.filter((p) => p.nickname.trim());
  if (players.length < 5) throw new Error("В составе должно быть не меньше пяти игроков");

  // Одна команда — одна заявка на турнир (решение Стаса, 23.08.2026): повторная отправка правит
  // прежнюю, а не плодит строку в очереди. Возвращённую заявку это тоже касается — досыл правок
  // снова ставит её в `pending` (`data.status` ниже), чтобы модератор увидел исправленный состав.
  //
  // Ищем и по подавшему, и по слагу команды: заявку может отправить менеджер, а поправить капитан
  // с другого аккаунта — очередь всё равно должна остаться с одной строкой на команду.
  const slug = draft.slug || slugify(name);
  const mine = await prisma.teamApplication.findFirst({
    where: {
      tournamentId,
      status: { in: ["pending", "rejected"] },
      OR: [{ submittedById: accountId }, { payload: { contains: `"slug":"${slug}"` } }],
    },
    orderBy: { submittedAt: "desc" },
  });
  const data = {
    tournamentId,
    divisionId,
    source: "web",
    payload: formatDraft({ ...draft, name, players, slug }),
    submittedById: accountId,
    status: "pending",
    notes: null,
    submittedAt: new Date(),
  };
  return mine
    ? prisma.teamApplication.update({ where: { id: mine.id }, data })
    : prisma.teamApplication.create({ data });
}

/**
 * Заявка из телеграм-бота (`src/lib/tg-quiz.ts`). Тот же поток и та же очередь, что у капитана с
 * сайта, — расходятся только в авторе: у бота аккаунта нет, `submittedById` остаётся пустым, а
 * человека оператор опознаёт по телеграму капитана в составе. Поэтому и дедуп здесь только по
 * слагу: сопоставить чат с прежней заявкой не по чему.
 *
 * Проверки состава (пустое имя, меньше пяти игроков) квиз делает по шагам — переспросить на месте
 * дешевле, чем отбить готовую заявку в конце; здесь остаётся то, что зависит от БД.
 */
export async function submitTelegramApplication(
  tournamentId: number,
  divisionId: number | null,
  draft: TeamDraft,
  answers: Answer[] = [],
  chatId: string | null = null,
) {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw new Error("Турнир не найден");
  if (!registrationOpen(tournament)) throw new Error("Приём заявок на этот турнир закрыт");

  const slug = draft.slug || slugify(draft.name);
  // Дедуп по чату либо по слагу: один капитан правит свою заявку из того же чата, а слаг ловит
  // случай, когда ту же команду подают заново с другого телефона.
  const mine = await prisma.teamApplication.findFirst({
    where: {
      tournamentId,
      status: { in: ["pending", "rejected"] },
      OR: [...(chatId ? [{ submittedChatId: chatId }] : []), { payload: { contains: `"slug":"${slug}"` } }],
    },
    orderBy: { submittedAt: "desc" },
  });
  const data = {
    tournamentId,
    divisionId,
    source: "telegram",
    payload: formatDraft({ ...draft, slug }, answers),
    submittedChatId: chatId,
    status: "pending",
    notes: null,
    submittedAt: new Date(),
  };
  return mine
    ? prisma.teamApplication.update({ where: { id: mine.id }, data })
    : prisma.teamApplication.create({ data });
}

/** Заявки, поданные этим аккаунтом — кабинет показывает их статус и причину возврата. */
export const myApplications = (accountId: number, tournamentId?: number) =>
  prisma.teamApplication.findMany({
    where: { submittedById: accountId, ...(tournamentId ? { tournamentId } : {}) },
    orderBy: { submittedAt: "desc" },
    include: { tournament: true, division: true },
  });

// ── проверки до записи ───────────────────────────────────────────────────────

export type Problem = { level: "block" | "warn" | "info"; text: string };

/**
 * Что не так с заявкой. `block` не даёт апрувить (данные развалят ростер), `warn` — на усмотрение
 * оператора, `info` — просто «вот что произойдёт при записи».
 */
export async function applicationProblems(team: TeamDraft, divisionId: number | null): Promise<Problem[]> {
  const problems: Problem[] = [];

  const existingTeam = await prisma.team.findUnique({ where: { slug: team.slug } });
  if (existingTeam)
    problems.push({
      level: "info",
      text: `Слаг «${team.slug}» занят командой «${existingTeam.name}» — состав допишется к ней, новая заведена не будет`,
    });

  if (team.players.length === 0) problems.push({ level: "block", text: "В заявке нет игроков" });
  const core = team.players.filter((p) => isCoreRole(p.role)).length;
  if (core < 5)
    problems.push({ level: "warn", text: `Основы меньше пяти: позиций 1–5 заполнено ${core}` });

  // Дубли внутри самой заявки: один человек под двумя никами — ошибка составителя, а не лиги.
  const seenIds = new Map<string, string>();
  const seenNicks = new Set<string>();
  for (const p of team.players) {
    const nick = p.nickname.toLowerCase();
    if (seenNicks.has(nick)) problems.push({ level: "block", text: `Ник «${p.nickname}» в заявке дважды` });
    seenNicks.add(nick);
    const id = p.accountId;
    if (!id) continue;
    const prev = seenIds.get(id);
    if (prev) problems.push({ level: "block", text: `Один account_id ${id} у «${prev}» и «${p.nickname}»` });
    seenIds.set(id, p.nickname);
  }

  for (const p of team.players) {
    const known = await findPlayer(p);
    if (known)
      problems.push({
        level: "info",
        text: `«${p.nickname}» уже в ростере (${known.nickname}) — заявка привяжет его, второй профиль не заведётся`,
      });
    if (p.dotaName && p.dotaName.toLowerCase() !== p.nickname.toLowerCase())
      problems.push({ level: "info", text: `«${p.nickname}»: в клиенте Доты он «${p.dotaName}»` });
    if (!p.accountId && !p.dotabuffUrl && !p.stratzUrl && !p.steamUrl)
      problems.push({ level: "warn", text: `«${p.nickname}»: нет ни одной ссылки на профиль — в архиве матчей его не опознать` });
    if (!p.role) problems.push({ level: "warn", text: `«${p.nickname}»: не разобрана роль` });
  }

  // Конфликт составов: действующим можно быть только в одной команде дивизиона (roster-spots.ts).
  for (const p of team.players) {
    if (!isCoreRole(p.role)) continue;
    const found = await findPlayer(p);
    if (!found) continue;
    const spots = await prisma.rosterSpot.findMany({
      where: { playerId: found.id },
      include: { team: { select: { id: true, name: true } } },
    });
    const conflict = spotConflict(
      spots
        .filter((s) => s.team.id !== existingTeam?.id)
        .map((s) => ({ teamId: s.team.id, role: s.role, divisionId: s.divisionId, teamName: s.team.name })),
      { teamId: existingTeam?.id ?? -1, role: p.role, divisionId },
    );
    if (conflict) problems.push({ level: "block", text: `«${p.nickname}»: ${conflict}` });
  }

  return problems;
}

/**
 * Игрок ростера, соответствующий строке заявки. Сначала по account_id (он не меняется, в отличие от
 * ника), потом по слагу ника — так заявка на уже заведённого человека не плодит второй профиль.
 * `playerAccountId` смотрит и в поле, и в ссылки на профиль — id часто лежит только в них.
 */
async function findPlayer(draft: PlayerDraft) {
  if (draft.accountId) {
    const all = await prisma.player.findMany({
      where: {
        OR: [
          { accountId: draft.accountId },
          { dotabuffUrl: { contains: draft.accountId } },
          { stratzUrl: { contains: draft.accountId } },
          { steamUrl: { contains: draft.accountId } },
        ],
      },
    });
    const exact = all.find((p) => playerAccountId(p) === draft.accountId);
    if (exact) return exact;
  }
  const slug = slugify(draft.nickname);
  return slug ? prisma.player.findUnique({ where: { slug } }) : null;
}

/** Свободный слаг игрока: ник занят — добавляем суффикс. Слаг ставится один раз и не меняется. */
async function freePlayerSlug(nickname: string) {
  const base = slugify(nickname) || "player";
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    if (!(await prisma.player.findUnique({ where: { slug } }))) return slug;
  }
}

// ── апрув и возврат ──────────────────────────────────────────────────────────

/**
 * Одобрить заявку: завести (или дополнить) команду, игроков и состав, поставить команду в дивизион.
 * Право проверяет вызывающий (server-action): сюда БД-гарды не тянем — модуль зовут и скрипты.
 *
 * MMR из заявки пишем только новым игрокам и только как заявленный: у существующего профиля цифру
 * ставил оператор, и чужая таблица не должна её перебивать (то же правило, что в анкете кабинета).
 */
/**
 * Записать состав в ростер: завести (или дополнить) команду, игроков и состав, поставить команду
 * в дивизион. Единственное место, которое пишет ростер из черновика — его зовут и импорт таблицы,
 * и апрув заявки: два пути записи разошлись бы правилами уже на второй правке.
 *
 * MMR из черновика пишем только новым игрокам и только как заявленный: у существующего профиля
 * цифру ставил оператор, и чужая таблица не должна её перебивать (то же правило, что в анкете).
 */
export async function writeTeamToRoster(draft: TeamDraft, divisionId: number) {
  const team =
    (await prisma.team.findUnique({ where: { slug: draft.slug } })) ??
    (await prisma.team.create({ data: { slug: draft.slug, name: draft.name, tag: draft.tag } }));

  for (const p of draft.players) {
    const existing = await findPlayer(p);
    const player =
      existing ??
      (await prisma.player.create({
        data: {
          slug: await freePlayerSlug(p.nickname),
          nickname: p.nickname,
          realName: p.realName,
          accountId: p.accountId,
          mmr: p.mmr,
          rank: p.rank ?? null,
          dotabuffUrl: p.dotabuffUrl,
          stratzUrl: p.stratzUrl,
          steamUrl: p.steamUrl,
          telegram: p.telegram,
        },
      }));

    // Ссылки и account_id дописываем и существующему: пустое поле заполнить полезно, заполненное
    // не трогаем — там могла быть ручная правка оператора.
    if (existing) {
      await prisma.player.update({
        where: { id: existing.id },
        data: {
          accountId: existing.accountId ?? p.accountId,
          dotabuffUrl: existing.dotabuffUrl ?? p.dotabuffUrl,
          stratzUrl: existing.stratzUrl ?? p.stratzUrl,
          steamUrl: existing.steamUrl ?? p.steamUrl,
          telegram: existing.telegram ?? p.telegram,
          // Ранг — не мнение, а факт из OpenDota: свежий перекрывает старый (в отличие от MMR,
          // который у существующего профиля ставил оператор).
          rank: p.rank ?? existing.rank,
        },
      });
    }

    // Место заводим в дивизион турнира: состав сезонный, и запись нового турнира не должна
    // переписывать состав прошлого.
    const spot = await prisma.rosterSpot.findFirst({
      where: { teamId: team.id, playerId: player.id, divisionId },
    });
    await (spot
      ? prisma.rosterSpot.update({ where: { id: spot.id }, data: { role: p.role, isCaptain: p.isCaptain } })
      : prisma.rosterSpot.create({
          data: { teamId: team.id, playerId: player.id, divisionId, role: p.role, isCaptain: p.isCaptain },
        }));
  }

  await setTeamDivision(team.id, divisionId);
  return team;
}

/** Одобрить заявку: тот же путь записи, что у импорта, плюс отметка о решении. */
export async function approveApplication(applicationId: number, reviewerId: number | null) {
  const application = await prisma.teamApplication.findUnique({
    where: { id: applicationId },
    include: { division: true },
  });
  if (!application) throw new Error("Заявка не найдена");
  if (application.status === "approved") throw new Error("Заявка уже одобрена");
  const draft = parseDraft(application.payload);
  if (!draft) throw new Error("Заявка пустая или битая — верните её с причиной");
  if (!application.divisionId) throw new Error("Сначала выберите дивизион для команды");

  const team = await writeTeamToRoster(draft, application.divisionId);

  return prisma.teamApplication.update({
    where: { id: applicationId },
    data: { status: "approved", teamId: team.id, reviewedAt: new Date(), reviewedById: reviewerId, notes: null },
  });
}

/** Вернуть заявку с причиной. Причина обязательна: «отклонено» без объяснения нечего исправлять. */
export async function rejectApplication(applicationId: number, reason: string, reviewerId: number | null) {
  const notes = reason.trim();
  if (!notes) throw new Error("Укажите причину возврата");
  return prisma.teamApplication.update({
    where: { id: applicationId },
    data: { status: "rejected", notes, reviewedAt: new Date(), reviewedById: reviewerId },
  });
}

/** Удалить заявку целиком — для мусора, залитого не тем файлом. */
export const deleteApplication = (id: number) => prisma.teamApplication.delete({ where: { id } });
