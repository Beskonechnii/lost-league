// Дефолтный граф диалога бота — сидом в коде, а не строкой в базе. Порядок тот же, что у настроек
// (`bot-settings.ts`): в `BotFlow` лежат только правки оператора, а пустая база означает бота с
// обычным флоу, а не бота без флоу.
//
// **Граф ведёт весь входящий путь — и с Э6 он единственный.** Первый уровень и справки — ноды-
// действия поверх того же кода, что раньше звал рукописный путь (`actions.ts`); регистрация,
// правка профиля, заказ встречи, анкеты и ответ сопернику — ноды-модули поверх рукописных диалогов
// (`subflows.ts`). Старого обработчика за графом больше нет: команды и кнопки, которые ловились
// раньше `if`-ами в начале `handleMessage`, стали **перехватами** — свойством графа (`intercepts`).
//
// **Экран — одна нода, текст приносит действие.** `screen-main` и `tour-screen` показывают
// `{vars.экран}`: клавиатура у экрана постоянная, а содержимое каждый раз своё. Разводить их по
// ноде на каждую справку значило бы держать пять копий одной клавиатуры и править их вместе.
//
// Подписи кнопок берём из тех же констант, что и модули: подпись — это ключ перехода, и разъехаться
// ей с тем, что модуль ждёт в ответ, нельзя.

import { FORMS_BUTTON } from "../tg-forms";
import { MEETING_BUTTON, MR_ACCEPT, MR_COUNTER } from "../tg-meetings";
import { LEGACY_ROSTER, MENU } from "../tg-menu";
import { EDIT_BUTTON } from "../tg-profile";
import { REGISTER_BUTTON } from "../tg-register";
import { BACK, MY_TEAM, TEAMS, TT_EXIT } from "../tg-tournaments";
import type { BotFlowGraph, FlowButton, FlowIntercept } from "./types";

/** Ключ единственного пока флоу. Разные графы под разные входы появятся на Э7. */
export const FLOW_KEY = "main";

/** Нода меню — на неё возвращаются концы диалогов, её же показывает /start. */
export const MENU_NODE = "menu";

/** Экран справки: профиль, код входа, «не нашли вас», «турниров нет». */
const SCREEN = "screen-main";

/** Экран выбранного турнира: карточка, состав, ссылка на заявку, «команд пока нет». */
const TOURNAMENT = "tour-screen";

/**
 * Кнопки первого уровня — они повторяются на экране справки. Регистрация показывается тому, кого
 * лига не знает, анкеты — когда открытая анкета есть; обе с Э5 ведут в свои ноды-модули.
 */
const mainButtons = (register: FlowButton["when"]): FlowButton[] => [
  { label: REGISTER_BUTTON, next: "reg-do", when: register, row: 8 },
  { label: MENU.profile, next: "profile-do", row: 9 },
  { label: MENU.tournaments, next: "tour-list", row: 9 },
  { label: FORMS_BUTTON, next: "forms-do", when: { left: "ctx.есть_анкеты", op: "=", right: "да" }, row: 10 },
];

/**
 * Текст меню — свойство ноды, а не строка второго реестра (Э6). До Э6 он жил ключом `menu` в
 * `BotQuestion`/`quiz-config.ts`, и формулировки бота настраивались в двух местах сразу: часть в
 * графе, часть во вкладке «Вопросы». Теперь место одно — инспектор ноды.
 */
const MENU_TEXT =
  "Бот лиги LOST. «Личный профиль» — ваша анкета, вход на сайт и правки; «Турниры» — сезоны, ваш " +
  "состав, команды соперников и подача заявки.\n" +
  "Выберите кнопкой ниже.";

/**
 * Перехваты уровня флоу — то, что до Э6 было россыпью `if` в начале `handleMessage`.
 *
 * Три вида, и все три пришли из старого пути:
 *   · команды `/start` и `/cancel` — единственный способ бросить начатое, поэтому `force`;
 *   · кнопки первого уровня — клавиатура у Telegram висит до отмены, и человек нажимает их из
 *     любого места, где стоит. Посреди ноды-модуля их принимает политика ноды («повторить»);
 *   · кнопки, которые ставит не экран, а уведомление («Принять время») или прошлая версия меню
 *     («Мой состав», «Подать заявку»): нода, с которой они пришли, могла быть неделю назад.
 *
 * Чего здесь намеренно нет: «Заказать встречу» и «Подать заявку» как действия — им нужен турнир,
 * выбранный на экране (`vars.турнир_id`), и вне турнира они значат не то же самое. Первая живёт
 * кнопкой экрана турнира, вторая ловится перехватом-подсказкой, а не действием.
 */
const intercepts = (): FlowIntercept[] => [
  // Ссылка-приглашение со страницы сборки состава: человек пришёл по делу, и лишний экран между
  // ним и анкетой — потерянный игрок. Уже знакомого лиге модуль вернёт в меню сам.
  { match: "/start invite", to: "reg-do", force: true },
  { match: "/start", to: MENU_NODE, force: true },
  { match: "/cancel", to: MENU_NODE, text: "Отменил.", force: true },

  { match: REGISTER_BUTTON, to: "reg-do" },
  { match: MENU.profile, to: "profile-do" },
  { match: MENU.tournaments, to: "tour-list" },
  { match: FORMS_BUTTON, to: "forms-do" },
  { match: EDIT_BUTTON, to: "edit-do" },
  { match: MENU.login, to: "login-do" },

  // Ответ на предложение соперника: клавиатуру поставило уведомление, и нажимают её откуда угодно.
  { match: MR_ACCEPT, to: "answer-do" },
  { match: MR_COUNTER, to: "answer-do" },

  // Кнопки прошлых версий меню: состав и заявка переехали внутрь турнира. Ведём туда, где они
  // теперь живут, и объясняем словами — иначе человек второй раз нажмёт то же самое.
  {
    match: LEGACY_ROSTER,
    to: "tour-list",
    text: `Состав теперь внутри турнира: «${MENU.tournaments}» → ваш турнир → «${MY_TEAM}».`,
  },
  {
    match: MENU.apply,
    to: "tour-list",
    text: `Заявка подаётся внутри турнира: «${MENU.tournaments}» → ваш турнир → «${MENU.apply}».`,
  },
];

export const defaultFlow = (): BotFlowGraph => ({
  format: 1,
  key: FLOW_KEY,
  start: "start",
  intercepts: intercepts(),
  nodes: [
    { id: "start", type: "start", title: "/start", next: MENU_NODE, x: 0, y: 0 },

    {
      id: MENU_NODE,
      type: "menu",
      title: "Главное меню",
      text: MENU_TEXT,
      x: 0,
      y: 140,
      // Кнопку регистрации прячем от того, кого лига знает: звать в лигу того, кто в ней играет,
      // значит путать.
      buttons: mainButtons({ left: "ctx.известен", op: "нет" }),
      // Непонятый текст — показать меню заново: кнопки прошлых версий и ответы сопернику разобраны
      // перехватами выше, а на всё прочее бот и раньше отвечал ровно меню.
      else: MENU_NODE,
    },

    /* ── Модули: диалоги, которые пишут в базу ────────────────────────────────────────────── */
    //
    // «Отменено» у модуля значит «не взялся»: человек уже в лиге, править нечего, капитанского
    // места нет, открытых анкет нет. Причину модуль объясняет сам, поэтому оба выхода ведут туда
    // же, куда и «готово», — добавлять от графа второе объяснение значило бы говорить дважды.

    { id: "reg-do", type: "subflow", title: "Регистрация", flow: "регистрация", done: MENU_NODE, cancel: MENU_NODE, x: 1080, y: 140 },

    { id: "forms-do", type: "subflow", title: "Анкеты", flow: "анкета", done: MENU_NODE, cancel: MENU_NODE, x: 1080, y: 300 },

    // После правки профиля показываем карточку заново: человек только что просил её изменить и
    // должен увидеть, что ушло организатору.
    { id: "edit-do", type: "subflow", title: "Правка профиля", flow: "правка_профиля", done: "profile-do", cancel: "profile-do", x: 1080, y: 540 },

    // Турнир модулю передаём параметром: капитан заказывает встречу в том турнире, экран которого
    // открыт, а не выбирает из всех своих команд заново.
    { id: "meet-do", type: "subflow", title: "Заказ встречи", flow: "заказ_встречи", params: { турнир: "{vars.турнир_id}" }, done: "tour-open", cancel: "tour-open", x: 1080, y: 860 },

    // Ответ на чужое предложение. Входа с экрана у него нет вовсе — только перехват: кнопку
    // поставило уведомление, и человек нажимает её из любого места, где стоял.
    { id: "answer-do", type: "subflow", title: "Ответ сопернику", flow: "ответ_сопернику", done: MENU_NODE, cancel: MENU_NODE, x: 1440, y: 860 },

    /* ── Профиль и вход ───────────────────────────────────────────────────────────────────── */

    { id: "profile-do", type: "action", title: "Собрать профиль", action: "профиль", params: {}, ok: SCREEN, fail: SCREEN, x: 0, y: 380 },

    {
      id: SCREEN,
      type: "menu",
      title: "Экран справки",
      text: "{vars.экран}",
      x: 0,
      y: 540,
      buttons: [
        // Правку и вход даём по привязке `tgId`, а не по хендлу: хендл — не удостоверение.
        { label: EDIT_BUTTON, next: "edit-do", when: { left: "vars.правка", op: "=", right: "да" }, row: 0 },
        { label: MENU.login, next: "login-do", when: { left: "vars.вход", op: "=", right: "да" }, row: 1 },
        // Здесь регистрацию показываем не по `ctx.известен`, а по тому, что сказало действие: у
        // человека с анкетой в очереди кабинет уже есть, и звать его регистрироваться снова незачем.
        ...mainButtons({ left: "vars.новичок", op: "=", right: "да" }),
      ],
      // Непонятый ответ — показать экран заново: он уже собран в `vars.экран`, второй раз в базу
      // за ним не идём.
      else: SCREEN,
    },

    { id: "login-do", type: "action", title: "Код входа", action: "код_входа", params: {}, ok: SCREEN, fail: SCREEN, x: 0, y: 880 },

    /* ── Турниры ──────────────────────────────────────────────────────────────────────────── */

    { id: "tour-list", type: "action", title: "Список турниров", action: "турниры", params: {}, ok: "tour-pick", fail: SCREEN, x: 360, y: 380 },

    {
      id: "tour-pick",
      type: "ask",
      title: "Какой турнир",
      text: "{vars.экран}",
      // Кнопки с названиями турниров приносит действие: граф не знает их заранее.
      var: "турнир",
      buttons: [{ label: TT_EXIT, next: MENU_NODE, row: 0 }],
      check: null,
      else: "tour-open",
      x: 360,
      y: 540,
    },

    { id: "tour-open", type: "action", title: "Открыть турнир", action: "турнир", params: { имя: "{vars.турнир}" }, ok: TOURNAMENT, fail: "tour-list", x: 360, y: 700 },

    {
      id: TOURNAMENT,
      type: "menu",
      title: "Экран турнира",
      text: "{vars.экран}",
      x: 360,
      y: 860,
      buttons: [
        { label: MY_TEAM, next: "team-do", row: 0 },
        { label: TEAMS, next: "teams-do", row: 1 },
        // Заказ встречи — только капитану этого турнира: остальным кнопка обещала бы то, чего им
        // нельзя. Сам заказ ведёт модуль `tg-meetings.ts`.
        { label: MEETING_BUTTON, next: "meet-do", when: { left: "vars.встреча", op: "=", right: "да" }, row: 2 },
        { label: MENU.apply, next: "apply-do", when: { left: "vars.заявка", op: "=", right: "да" }, row: 3 },
        { label: BACK, next: "tour-list", row: 4 },
        { label: TT_EXIT, next: MENU_NODE, row: 4 },
      ],
      // Непонятый ответ — заново открыть тот же турнир: так экран обновится, а если турнир уехал
      // в черновики, действие само вернёт человека к списку.
      else: "tour-open",
    },

    { id: "team-do", type: "action", title: "Мой состав", action: "мой_состав", params: { турнир: "{vars.турнир_id}" }, ok: TOURNAMENT, fail: SCREEN, x: 0, y: 1180 },

    { id: "apply-do", type: "action", title: "Подать заявку", action: "заявка", params: { турнир: "{vars.турнир_id}" }, ok: TOURNAMENT, fail: TOURNAMENT, x: 360, y: 1180 },

    { id: "teams-do", type: "action", title: "Команды турнира", action: "команды", params: { турнир: "{vars.турнир_id}" }, ok: "teams-pick", fail: TOURNAMENT, x: 720, y: 1180 },

    {
      id: "teams-pick",
      type: "ask",
      title: "Чью команду смотрим",
      text: "{vars.экран}",
      var: "команда",
      buttons: [
        { label: BACK, next: "tour-list", row: 0 },
        { label: TT_EXIT, next: MENU_NODE, row: 0 },
      ],
      check: null,
      else: "card-do",
      x: 720,
      y: 1340,
    },

    // Карточка возвращает человека в тот же список: кнопки команд приходят с ней же, поэтому
    // клавиатура не пропадает.
    { id: "card-do", type: "action", title: "Карточка команды", action: "команда", params: { турнир: "{vars.турнир_id}", имя: "{vars.команда}" }, ok: "teams-pick", fail: "teams-do", x: 720, y: 1500 },
  ],
});
