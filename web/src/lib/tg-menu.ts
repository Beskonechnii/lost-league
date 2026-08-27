// Только сервер / скрипт: меню телеграм-бота — то, что человек может спросить вне квиза.
//
// Кнопки постоянные: «Подать заявку», «Мой состав», «Личный профиль», «Турниры», «Войти на сайт».
// Человека узнаём тремя заходами, в порядке надёжности: привязка `UserAccount.tgId` (её даёт
// регистрация в боте — `tg-register.ts`), телеграм-хендл в ростере (`Player.telegram`), account_id
// из его заявок.
//
// **Хендл — не удостоверение.** Его можно сменить, и тогда бот человека не узнает; наоборот,
// освободившийся хендл может занять посторонний. Поэтому справочные разделы показывают только то,
// что и так публично на сайте (состав, карточка игрока, турниры), и ничего не меняют. Всё, что
// пишет, идёт через квиз и очередь модерации. Единственное исключение — «Войти на сайт»: код входа
// выдаётся строго по привязке `tgId`, хендлу его не дают.

import { prisma } from "./prisma";
import type { Reply } from "./telegram";
import { normalizeTelegram, telegramUrl } from "./profiles";
import { roleShort, roleOrder } from "./roles";
import { TOURNAMENT_STATUS_LABELS, isTournamentStatus } from "./tournaments";
import { parseDraft } from "./team-application";
import { anyFormOpen, FORMS_BUTTON } from "./tg-forms";
import { REGISTER_BUTTON } from "./tg-register";
import { CODE_TTL_MIN, issueLoginCode, loginAccount, loginUrl, siteUrl } from "./tg-login";

/**
 * Запомнить чат: `chat_id` ↔ хендл. Telegram не даёт написать человеку по хендлу — только по
 * `chat_id`, а он появляется, лишь когда человек сам написал боту. Без этой записи некому отправить
 * решение организатора по заявке.
 */
export async function rememberChat(chatId: string, username: string | null | undefined): Promise<void> {
  const handle = normalizeTelegram(username ?? "");
  await prisma.tgChat.upsert({
    where: { chatId },
    create: { chatId, username: handle },
    update: { username: handle },
  });
}

/** Подписи кнопок — они же то, что приезжает текстом: reply-клавиатура шлёт обычные сообщения. */
export const MENU = {
  apply: "Подать заявку",
  roster: "Мой состав",
  profile: "Личный профиль",
  tournaments: "Турниры",
  login: "Войти на сайт",
} as const;

/**
 * Клавиатура меню. Кнопка «Анкеты» появляется, только когда открытая анкета есть: пустой раздел,
 * который на всё отвечает «сейчас ничего нет», хуже отсутствующего. Кнопка регистрации — наоборот,
 * только тем, кого лига ещё не знает: звать в лигу того, кто в ней играет, значит путать.
 */
export async function menuKeyboard(register = false): Promise<string[][]> {
  const rows: string[][] = [];
  if (register) rows.push([REGISTER_BUTTON]);
  rows.push([MENU.apply], [MENU.roster, MENU.profile], [MENU.tournaments, MENU.login]);
  if (await anyFormOpen()) rows.push([FORMS_BUTTON]);
  return rows;
}

export const isMenuButton = (text: string): boolean =>
  (Object.values(MENU) as string[]).includes(text.trim()) || text.trim() === FORMS_BUTTON;

/**
 * Игроки с этим хендлом — **все**, а не первый попавшийся. В ростере встречаются дубли: один человек
 * заведён дважды (импортом и заявкой) с разными `account_id`, и мест в составе может не быть у той
 * записи, что попалась первой. Показать пустоту, когда состав есть у соседней записи, — худшее из
 * поведений: человек видит «вас нет», хотя он в команде.
 *
 * Регистр хендла в Telegram не значим, а sqlite через Prisma не умеет `mode: "insensitive"` —
 * сравниваем в памяти: у ростера это сотни строк, не миллионы.
 */
async function playersByHandle(username: string | null | undefined): Promise<number[]> {
  const handle = normalizeTelegram(username ?? "");
  if (!handle) return [];
  const known = await prisma.player.findMany({
    where: { telegram: { not: null } },
    select: { id: true, telegram: true },
  });
  return known.filter((p) => p.telegram!.toLowerCase() === handle.toLowerCase()).map((p) => p.id);
}

/** «Не узнали» — один ответ на все разделы: без профиля показывать нечего. */
const unknown = async (username: string | null | undefined): Promise<Reply> => ({
  text: username
    ? `Не нашёл вас в лиге. Если вы в ростере под другим хендлом — скажите организатору, он поправит. ` +
      `Если вы здесь впервые — «${REGISTER_BUTTON}».`
    : "У вас не задан телеграм-хендл (@nickname) — по нему я узнаю игрока. Поставьте его в настройках " +
      "Telegram и напишите мне снова.",
  keyboard: await menuKeyboard(true),
});

/**
 * Кто это. Первый источник — привязка из регистрации в боте (`UserAccount.tgId`): она переживает
 * смену хендла, потому что ключом служит числовой id пользователя Telegram. Хендл и account_id из
 * заявок остаются запасными ветками — для тех, кто в лиге давно и через бота не регистрировался.
 */
export async function identify(
  chatId: string,
  username: string | null | undefined,
  tgId?: string | null,
): Promise<number[]> {
  const found = new Set<number>();

  if (tgId) {
    const account = await prisma.userAccount.findUnique({ where: { tgId }, select: { playerId: true } });
    if (account?.playerId) found.add(account.playerId);
  }
  for (const id of await playersByHandle(username)) found.add(id);

  // Второй заход — по `account_id` из заявок этого чата: капитан, только что подавший состав, в
  // ростере может быть заведён под другим хендлом. Номер аккаунта Dota надёжнее хендла: его не меняют.
  const accountIds = (await applicationsOf(chatId, username))
    .flatMap((a) => parseDraft(a.payload)?.players ?? [])
    .map((p) => p.accountId)
    .filter((id): id is string => !!id);
  if (accountIds.length) {
    const byAccount = await prisma.player.findMany({ where: { accountId: { in: accountIds } }, select: { id: true } });
    for (const p of byAccount) found.add(p.id);
  }
  return [...found];
}

/**
 * Заявки этого человека: из его чата (надёжно — чат запоминается при подаче) плюс те, где он указан
 * телеграмом в составе (заявку мог подать менеджер с другого телефона).
 */
async function applicationsOf(chatId: string, username: string | null | undefined) {
  const handle = normalizeTelegram(username ?? "");
  return prisma.teamApplication.findMany({
    where: {
      OR: [
        { submittedChatId: chatId },
        ...(handle ? [{ payload: { contains: `"telegram":"${handle}"` } }] : []),
      ],
    },
    orderBy: { submittedAt: "desc" },
    include: { tournament: true, division: true },
    take: 5,
  });
}

/** Строка статуса заявки — то, ради чего человек и жмёт «Мой состав» сразу после отправки. */
function applicationBlock(a: Awaited<ReturnType<typeof applicationsOf>>[number]): string {
  const draft = parseDraft(a.payload);
  const state =
    a.status === "approved"
      ? "Заявка одобрена — команда заведена в лигу."
      : a.status === "rejected"
        ? `Заявка возвращена${a.notes ? `: ${a.notes}` : ""}. Поправить — «${MENU.apply}».`
        : "Заявка на проверке у организатора.";
  const lines = (draft?.players ?? []).map((p) => {
    const parts = [`• <b>${p.nickname}</b>`, roleShort(p.role) ?? "без позиции"];
    if (p.isCaptain) parts.push("капитан");
    return parts.join(" — ");
  });
  return [
    `<b>${draft?.name ?? "Команда"}</b> — ${a.tournament.name}${a.division ? ` · ${a.division.name}` : ""}`,
    state,
    "",
    ...lines,
  ].join("\n");
}

/**
 * «Мой состав»: сначала поданные заявки со статусом, потом составы, уже заведённые в лигу.
 * Показываем и то, и другое: состав, собранный минуту назад, в ростере ещё не появился (он там будет
 * только после одобрения), а прошлые сезоны при этом никуда не делись.
 *
 * Состав всегда в разрезе турнира: команда переживает сезон, участие — нет, и «мой состав» без
 * турнира это два разных состава, слитые в один список.
 */
async function myRoster(chatId: string, username: string | null | undefined, tgId?: string | null): Promise<Reply> {
  const applications = await applicationsOf(chatId, username);
  // Одобренная заявка живёт дальше как состав в ростере — второй раз её же показывать незачем.
  const blocks = applications.filter((a) => a.status !== "approved").map(applicationBlock);

  const me = await identify(chatId, username, tgId);
  for (const playerId of me) blocks.push(...(await rosterBlocks(playerId)));

  if (blocks.length === 0) {
    // Человека нашли, но он никуда не заявлен — это не «мы вас не знаем», и путать одно с другим
    // нельзя: на первом живом прогоне бот так сказал игроку, который в лиге есть.
    if (me.length) {
      const player = await prisma.player.findUnique({ where: { id: me[0] }, select: { nickname: true } });
      return {
        text: `Вы есть в лиге как <b>${player?.nickname ?? "игрок"}</b>, но пока не в составе команды. ` +
          `Заявиться — «${MENU.apply}».`,
        keyboard: await menuKeyboard(),
      };
    }
    return unknown(username);
  }
  return { text: blocks.join("\n\n"), keyboard: await menuKeyboard() };
}

/** Составы игрока по турнирам, свежий сверху: он бывает заявлен и в D1, и в D2, и в прошлом сезоне. */
async function rosterBlocks(playerId: number): Promise<string[]> {
  const spots = await prisma.rosterSpot.findMany({
    where: { playerId },
    orderBy: [{ divisionId: "desc" }, { createdAt: "desc" }],
    include: { team: true, division: { include: { tournament: true } } },
    take: 3,
  });

  return Promise.all(
    spots.map(async (spot) => {
      const mates = await prisma.rosterSpot.findMany({
        where: { teamId: spot.teamId, divisionId: spot.divisionId },
        include: { player: true },
      });
      const lines = mates
        .sort((a, b) => roleOrder(a.role) - roleOrder(b.role))
        .map((m) => {
          const parts = [`• <b>${m.player.nickname}</b>`, roleShort(m.role) ?? "без позиции"];
          if (m.isCaptain) parts.push("капитан");
          return parts.join(" — ");
        });

      const next = await prisma.series.findFirst({
        where: { OR: [{ homeId: spot.teamId }, { awayId: spot.teamId }], startAt: { gte: new Date() } },
        orderBy: { startAt: "asc" },
        include: { home: true, away: true },
      });

      return [
        `<b>${spot.team.name}</b>${spot.division ? ` — ${spot.division.tournament.name} · ${spot.division.name}` : ""}`,
        "",
        ...lines,
        ...(next ? ["", `Ближайшая встреча: <b>${next.home.name}</b> — <b>${next.away.name}</b>${when(next.startAt)}`] : []),
      ].join("\n");
    }),
  );
}

/** Карточка игрока: то же, что видно на сайте, — бот лишь не заставляет за ней ходить. */
async function myProfile(chatId: string, username: string | null | undefined, tgId?: string | null): Promise<Reply> {
  const me = await identify(chatId, username, tgId);
  if (me.length === 0) return unknown(username);

  const candidates = await prisma.player.findMany({
    where: { id: { in: me } },
    include: { spots: { orderBy: { divisionId: "desc" }, take: 1, include: { team: true } } },
  });
  // Из дублей показываем ту запись, что реально играет: профиль без единого места в составе — почти
  // всегда осколок старого импорта, и человек себя в нём не узнаёт.
  const player = candidates.sort((a, b) => b.spots.length - a.spots.length)[0];
  if (!player) return unknown(username);

  const spot = player.spots[0];
  const facts = [
    spot ? `Команда: ${spot.team.name}` : null,
    roleShort(spot?.role) ? `Позиция: ${roleShort(spot?.role)}` : null,
    player.mmr ? `MMR: ${player.mmr}` : null,
    player.tp ? `TP за всё время: ${player.tp}` : null,
    [player.city, player.country].filter(Boolean).join(", ") || null,
    player.telegram ? telegramUrl(player.telegram) : null,
    player.dotabuffUrl,
    player.stratzUrl,
  ].filter(Boolean);

  // Дубль в ростере — не забота человека, но и молчать о нём нельзя: иначе он видит чужой MMR
  // и думает, что бот врёт. Склеивает записи оператор.
  const dupes =
    candidates.length > 1
      ? [``, `В ростере ${candidates.length} записи с вашим телеграмом (${candidates.map((c) => c.nickname).join(", ")}) — скажите организатору, он объединит.`]
      : [];

  return {
    text: [`<b>${player.nickname}</b>`, player.realName, "", ...facts, ...dupes].filter(Boolean).join("\n"),
    keyboard: await menuKeyboard(),
  };
}

/**
 * «Войти на сайт»: одноразовый код и адрес страницы (`src/lib/tg-login.ts`). Код выдаётся аккаунту
 * из регистрации в боте (`UserAccount.tgId`), а не хендлу: это ключ от кабинета, а хендл меняют —
 * тому, кого узнали только по нему, кода не даём.
 */
async function loginCode(
  chatId: string,
  username: string | null | undefined,
  tgId?: string | null,
): Promise<Reply> {
  const account = await loginAccount(tgId);
  if (!account) {
    // Разводим два случая: человек лиге известен (значит, аккаунт у него сайтовый — с почтой) и
    // человек лиге незнаком. Звать в регистрацию первого — путать его.
    const known = (await identify(chatId, username, tgId)).length > 0;
    return {
      text: known
        ? `Код я выдаю аккаунту, заведённому через меня, а вас лига знает и так — значит, кабинет у вас ` +
          `с почтой и паролем: ${siteUrl()}/me. Если войти не выходит — скажите организатору.`
        : `Вход по коду — для тех, кто зарегистрирован через меня. Если вы в лиге впервые — ` +
          `«${REGISTER_BUTTON}». Если аккаунт на сайте уже есть — входите там почтой: ${siteUrl()}/me`,
      keyboard: await menuKeyboard(!known),
    };
  }

  const { code } = await issueLoginCode(account.id);
  return {
    text: [
      `Откройте <a href="${loginUrl()}">${loginUrl()}</a> и введите код:`,
      "",
      `<code>${code}</code>`,
      "",
      `Код живёт ${CODE_TTL_MIN} минут и срабатывает один раз. Никому его не пересылайте — это вход в ваш кабинет.`,
    ].join("\n"),
    keyboard: await menuKeyboard(),
  };
}

/** Турниры, которые сейчас идут или принимают заявки. Черновики и сыгранные не показываем. */
async function tournaments(): Promise<Reply> {
  const rows = await prisma.tournament.findMany({
    where: { status: { in: ["registration", "running"] } },
    orderBy: [{ startAt: "desc" }, { id: "desc" }],
    include: { divisions: { orderBy: [{ orderNo: "asc" }, { id: "asc" }] } },
  });
  if (rows.length === 0) return { text: "Сейчас турниров нет — как объявим, напишу.", keyboard: await menuKeyboard() };

  const blocks = rows.map((t) => {
    const status = isTournamentStatus(t.status) ? TOURNAMENT_STATUS_LABELS[t.status] : t.status;
    const divisions = t.divisions.map((d) => d.name).join(", ");
    return [`<b>${t.name}</b> — ${status}`, divisions || null, t.format || null].filter(Boolean).join("\n");
  });
  return { text: blocks.join("\n\n"), keyboard: await menuKeyboard() };
}

/** Дата встречи по-человечески. Времени может не быть — тогда и не пишем. */
const when = (date: Date | null): string =>
  date
    ? `, ${date.toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}`
    : "";

/**
 * Ответ на кнопку меню. `null` — это не кнопка меню, разбирайся сам (квиз).
 * Заявку («Подать заявку») меню не обрабатывает: её ведёт квиз, здесь только справочные разделы.
 */
export async function menuReply(
  chatId: string,
  text: string,
  username: string | null | undefined,
  tgId?: string | null,
): Promise<Reply | null> {
  switch (text.trim()) {
    case MENU.roster:
      return myRoster(chatId, username, tgId);
    case MENU.profile:
      return myProfile(chatId, username, tgId);
    case MENU.tournaments:
      return tournaments();
    case MENU.login:
      return loginCode(chatId, username, tgId);
    default:
      return null;
  }
}
