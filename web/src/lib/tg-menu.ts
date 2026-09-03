// Только сервер / скрипт: меню телеграм-бота — первый уровень и справки, каждая в один ответ.
//
// **Первый уровень — три-четыре кнопки:** «Личный профиль», «Турниры», плюс «Анкеты» (когда
// открытая анкета есть) и «Регистрация» (когда лига человека не знает). Всё остальное живёт
// уровнем ниже, у того, к чему относится: «Войти на сайт» и «Изменить данные» — в профиле,
// состав и команды — внутри турнира (`tg-tournaments.ts`). Плоский список кнопок рос быстрее,
// чем помещался на экран телефона, и «Мой состав» на первом уровне всё равно врал: состав
// сезонный, а кнопка была одна на все сезоны.
//
// Человека узнаём тремя заходами, в порядке надёжности: привязка `UserAccount.tgId` (её даёт
// регистрация в боте — `tg-register.ts`), телеграм-хендл в ростере (`Player.telegram`), account_id
// из его заявок.
//
// **Хендл — не удостоверение.** Его можно сменить, и тогда бот человека не узнает; наоборот,
// освободившийся хендл может занять посторонний. Поэтому справочные разделы показывают только то,
// что и так публично на сайте (состав, карточка игрока, турниры), и ничего не меняют. Всё, что
// пишет, идёт через квиз и очередь модерации. Исключения — то, что опирается на привязку `tgId`, а
// не на хендл: «Войти на сайт» (код входа) и «Изменить данные» (правка своего профиля, `tg-profile.ts`).
// Обоим хендла мало: он не удостоверение.

import { prisma } from "./prisma";
import type { Reply } from "./telegram";
import { formatBirthday, normalizeTelegram, playerLinks, playerPath, telegramUrl } from "./profiles";
import { roleShort } from "./roles";
import { parseDraft } from "./team-application";
import { anyFormOpen, FORMS_BUTTON } from "./tg-forms";
import { REGISTER_BUTTON } from "./tg-register";
import { EDIT_BUTTON, editablePlayer } from "./tg-profile";
import { CODE_TTL_MIN, issueLoginCode, loginAccount, loginUrl } from "./tg-login";
import { siteUrl } from "./site";

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

/**
 * Подписи кнопок — они же то, что приезжает текстом: reply-клавиатура шлёт обычные сообщения.
 *
 * `apply` и `login` на первом уровне больше не показываются (заявка — внутри турнира, вход — в
 * профиле), но остаются здесь подписями: клавиатура у Telegram висит до отмены, и кнопку из
 * прошлой версии меню человек нажмёт ещё не раз — она должна работать, а не проваливаться в квиз.
 */
export const MENU = {
  apply: "Подать заявку",
  profile: "Личный профиль",
  tournaments: "Турниры",
  login: "Войти на сайт",
} as const;

/**
 * Собирает ли состав сам бот. С Э5 — нет: пятёрка набирается мышью из пула лиги на сайте
 * (`/tournaments/<slug>/apply`), а бот отдаёт туда ссылку. Пошаговый ввод ников в чате позволял
 * вписать кого угодно мимо лиги — ровно то, что новое правило запрещает.
 *
 * Флаг, а не удалённый код: квиз состава (`tg-quiz.ts`) остаётся до первого живого прогона нового
 * пути. Если на приёме заявок что-то пойдёт не так — откат здесь, в одну строку.
 */
export const QUIZ_ROSTER: boolean = false;

/**
 * Кнопка прошлой версии меню. Клавиатура у Telegram висит до отмены: у того, кто последний раз
 * писал боту неделю назад, на экране всё ещё «Мой состав», и нажмёт он её не раз. Ловим отдельно —
 * иначе текст кнопки уходит в квиз заявки (он начинается на любой непонятый текст) и человек
 * оказывается в диалоге, которого не просил.
 */
export const LEGACY_ROSTER = "Мой состав";

/**
 * Клавиатура первого уровня. Кнопка «Анкеты» появляется, только когда открытая анкета есть: пустой
 * раздел, который на всё отвечает «сейчас ничего нет», хуже отсутствующего. Кнопка регистрации —
 * наоборот, только тем, кого лига ещё не знает: звать в лигу того, кто в ней играет, значит путать.
 */
export async function menuKeyboard(register = false): Promise<string[][]> {
  const rows: string[][] = [];
  if (register) rows.push([REGISTER_BUTTON]);
  rows.push([MENU.profile, MENU.tournaments]);
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
export const unknownReply = async (username: string | null | undefined): Promise<Reply> => ({
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

  // Второй заход — по `account_id` из **своей строки** в заявке: капитан, только что подавший
  // состав, в ростере может быть заведён под другим хендлом, а номер аккаунта Dota надёжнее хендла —
  // его не меняют. Берём именно свою строку, а не весь состав: иначе «вами» оказывались все пятеро,
  // и бот показывал профиль сокомандника вместо своего.
  const handle = normalizeTelegram(username ?? "")?.toLowerCase() ?? null;
  const accountIds = (await applicationsOf(chatId, username))
    .flatMap((a) => {
      const players = parseDraft(a.payload)?.players ?? [];
      const byHandle = handle
        ? players.filter((p) => normalizeTelegram(p.telegram ?? "")?.toLowerCase() === handle)
        : [];
      // Хендла в составе нет, но заявка пришла из этого чата — значит подал её капитан.
      if (byHandle.length) return byHandle;
      return a.submittedChatId === chatId ? players.filter((p) => p.isCaptain) : [];
    })
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
export async function applicationsOf(chatId: string, username: string | null | undefined) {
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

/**
 * Личный профиль: всё, что лига о человеке знает, — анкета, турнирная строка, TP и ссылки. Показ
 * читает то же, что и карточка на сайте; бот лишь не заставляет за ней ходить.
 *
 * **Текст отдельно от клавиатуры** (Э4): карточку показывают двое — рукописное меню (`myProfile`
 * ниже) и нода-действие нодового флоу (`bot-flow/actions.ts`), а кнопки у них свои. Поэтому здесь
 * только содержимое и признаки «что этому человеку доступно»: привязан ли профиль (правка данных,
 * `tg-profile.ts`) и есть ли аккаунт из регистрации в боте (код входа, `tg-login.ts`). Кнопка
 * «Изменить данные» появляется только у **привязанного** профиля: узнанному по хендлу бот
 * показывает, но не даёт править. Рядом с ней живёт «Войти на сайт»: вход — это про свой аккаунт,
 * а не про лигу, и на первом уровне меню он занимал место, ничего не объясняя.
 */
export type ProfileCard = {
  text: string;
  /** Лига знает этого человека: в ростере есть его игрок. */
  known: boolean;
  /** Профиль привязан (`UserAccount.tgId`) — данные можно править (`tg-profile.ts`). */
  canEdit: boolean;
  /** Есть аккаунт из регистрации в боте — ему можно выдать код входа (`tg-login.ts`). */
  canLogin: boolean;
};

export async function profileCard(
  chatId: string,
  username: string | null | undefined,
  tgId?: string | null,
): Promise<ProfileCard> {
  const me = await identify(chatId, username, tgId);
  const account = await loginAccount(tgId);
  // Аккаунт есть, а игрока ещё нет — это тот, чья регистрация лежит в очереди у организатора.
  // Показывать ему «не нашёл вас в лиге» нечестно (анкету он подал), а войти на сайт и посмотреть
  // статус заявки он вправе — за этим кнопка входа и нужна прямо здесь.
  if (me.length === 0 && account) {
    return {
      text: `Анкета на проверке у организатора — как решит, я напишу. Пока можно заглянуть в кабинет: «${MENU.login}».`,
      known: false,
      canEdit: false,
      canLogin: true,
    };
  }
  if (me.length === 0) {
    return { text: (await unknownReply(username)).text, known: false, canEdit: false, canLogin: false };
  }

  const candidates = await prisma.player.findMany({
    where: { id: { in: me } },
    include: {
      // Последнее место в составе: свежий дивизион сверху, внутри него — последняя запись.
      spots: {
        orderBy: [{ divisionId: "desc" }, { createdAt: "desc" }],
        take: 1,
        include: { team: true, division: { include: { tournament: true } } },
      },
    },
  });
  const linked = await editablePlayer(tgId);
  // Привязка — точнее любой эвристики: это тот самый человек. Без неё из дублей показываем запись,
  // которая реально играет, и из них — с самым свежим местом в составе: профиль без единого места
  // почти всегда осколок старого импорта, и человек себя в нём не узнаёт. Мест здесь не больше
  // одного (`take: 1` выше — оно уже самое свежее), поэтому сравниваем его, а не их число.
  const fresher = (a: (typeof candidates)[number], b: (typeof candidates)[number]) => {
    const [x, y] = [a.spots[0], b.spots[0]];
    if (!x || !y) return (y ? 1 : 0) - (x ? 1 : 0);
    return (y.divisionId ?? 0) - (x.divisionId ?? 0) || y.createdAt.getTime() - x.createdAt.getTime();
  };
  const player = candidates.find((c) => c.id === linked?.id) ?? [...candidates].sort(fresher)[0];
  if (!player) {
    return { text: (await unknownReply(username)).text, known: false, canEdit: false, canLogin: !!account };
  }

  const spot = player.spots[0];
  const links = playerLinks(player);

  // Анкетная часть — то, что человек о себе сказал.
  const about = [
    player.realName ? `Имя: ${player.realName}` : null,
    [player.city, player.country].filter(Boolean).join(", ") ? `Город: ${[player.city, player.country].filter(Boolean).join(", ")}` : null,
    player.birthday ? `Дата рождения: ${formatBirthday(player.birthday)}` : null,
    player.mmr ? `MMR: ${player.mmr}` : null,
    // TP — сумма за всё время (кеш реестра, src/lib/tp.ts). Ноль показываем тоже: «TP: 0» честнее
    // молчания, из которого человек делает вывод, что бот их не считает.
    `TP за всё время: ${player.tp}`,
  ].filter(Boolean);

  // Турнирная часть: команда всегда в разрезе турнира — участие сезонное, а команда переживает сезон.
  const tournament = spot?.division?.tournament;
  const team = spot
    ? [
        `<b>${spot.team.name}</b>${tournament ? ` — ${tournament.name}${spot.division ? ` · ${spot.division.name}` : ""}` : ""}`,
        [roleShort(spot.role) ?? "без позиции", spot.isCaptain ? "капитан" : null].filter(Boolean).join(" · "),
      ]
    : ["Пока не в составе команды."];

  const contacts = [
    // Своя карточка на сайте — первой строкой: за ссылкой «покажи, как я выгляжу в лиге» человек
    // и приходит, а искать её на сайте руками значит знать, что она вообще есть.
    `Профиль в лиге: ${siteUrl()}${playerPath(player.id)}`,
    links.dotabuff ? `Dotabuff: ${links.dotabuff}` : null,
    links.stratz ? `Stratz: ${links.stratz}` : null,
    links.steam ? `Steam: ${links.steam}` : null,
    player.telegram ? `Телеграм: ${telegramUrl(player.telegram)}` : null,
  ].filter(Boolean);

  // Дубль в ростере — не забота человека, но и молчать о нём нельзя: иначе он видит чужой MMR
  // и думает, что бот врёт. Склеивает записи оператор.
  const dupes =
    candidates.length > 1
      ? [``, `В ростере ${candidates.length} записи с вашим телеграмом (${candidates.map((c) => c.nickname).join(", ")}) — скажите организатору, он объединит.`]
      : [];

  return {
    text: [
      `<b>${player.nickname}</b>`,
      "",
      ...about,
      "",
      ...team,
      ...(contacts.length ? ["", ...contacts] : []),
      ...dupes,
      ...(linked ? ["", `Что-то не так — «${EDIT_BUTTON}»: правку посмотрит организатор.`] : []),
    ]
      .filter((line) => line !== null)
      .join("\n"),
    known: true,
    canEdit: !!linked,
    canLogin: !!account,
  };
}

/** Экран профиля в рукописном меню: карточка (выше) плюс кнопки своего аккаунта над меню. */
async function myProfile(chatId: string, username: string | null | undefined, tgId?: string | null): Promise<Reply> {
  const card = await profileCard(chatId, username, tgId);
  if (!card.known) {
    // Анкета в очереди: кабинет у человека уже есть, а игрока ещё нет — зовём войти, а не
    // регистрироваться заново.
    if (card.canLogin) return { text: card.text, keyboard: [[MENU.login], ...(await menuKeyboard())] };
    return { text: card.text, keyboard: await menuKeyboard(true) };
  }
  const keyboard = await menuKeyboard();
  // Кнопки своего аккаунта — первыми строками: за ними человек сюда и пришёл, а меню он и так знает.
  // Вход даём по тому же правилу, что и правку, — по привязке `tgId`, а не по хендлу (`tg-login.ts`).
  if (card.canLogin) keyboard.unshift([MENU.login]);
  if (card.canEdit) keyboard.unshift([EDIT_BUTTON]);
  return { text: card.text, keyboard };
}

/**
 * «Войти на сайт»: одноразовый код и адрес страницы (`src/lib/tg-login.ts`). Код выдаётся аккаунту
 * из регистрации в боте (`UserAccount.tgId`), а не хендлу: это ключ от кабинета, а хендл меняют —
 * тому, кого узнали только по нему, кода не даём.
 *
 * Текст отдельно от клавиатуры по той же причине, что и карточка профиля: то же самое показывает
 * нода-действие нодового флоу, а кнопки у неё свои (`bot-flow/actions.ts`).
 */
export type LoginCodeText = {
  text: string;
  /** Код выдан. `false` — аккаунта под этот телеграм нет, в тексте объяснено почему. */
  issued: boolean;
  /** Лига этого человека знает: ему предлагать регистрацию не надо. */
  known: boolean;
};

export async function loginCodeText(
  chatId: string,
  username: string | null | undefined,
  tgId?: string | null,
): Promise<LoginCodeText> {
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
      issued: false,
      known,
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
    issued: true,
    known: true,
  };
}

/** Экран «Войти на сайт» в рукописном меню: текст кода (выше) плюс клавиатура первого уровня. */
async function loginCode(
  chatId: string,
  username: string | null | undefined,
  tgId?: string | null,
): Promise<Reply> {
  const code = await loginCodeText(chatId, username, tgId);
  return { text: code.text, keyboard: await menuKeyboard(!code.issued && !code.known) };
}

/**
 * Ответ на кнопку меню. `null` — это не кнопка меню, разбирайся сам (квиз).
 *
 * Заявку («Подать заявку») меню не обрабатывает: её ведёт квиз. Турниры — тоже: у них свой раздел
 * с навигацией и состоянием (`tg-tournaments.ts`), а здесь только справки в один ответ.
 */
export async function menuReply(
  chatId: string,
  text: string,
  username: string | null | undefined,
  tgId?: string | null,
): Promise<Reply | null> {
  switch (text.trim()) {
    case MENU.profile:
      return myProfile(chatId, username, tgId);
    case MENU.login:
      return loginCode(chatId, username, tgId);
    default:
      return null;
  }
}
