// Дефолтный граф диалога бота — сидом в коде, а не строкой в базе. Порядок тот же, что у вопросов
// (`quiz-config.ts`) и настроек (`bot-settings.ts`): в `BotFlow` лежат только правки оператора, а
// пустая база означает бота с обычным флоу, а не бота без флоу.
//
// **Что граф ведёт с Э5: весь входящий путь.** Первый уровень и справки — ноды-действия поверх того
// же кода, что зовёт рукописный путь (`actions.ts`); регистрация, правка профиля, заказ встречи и
// анкеты — ноды-модули поверх рукописных диалогов (`subflows.ts`). За старым обработчиком остаётся
// квиз заявки состава (`QUIZ_ROSTER`, сегодня выключен) и перехваты уровня чата: ответ на
// предложение соперника и кнопки прошлых версий меню. Они уедут на Э6 вместе с флагом.
//
// **Экран — одна нода, текст приносит действие.** `screen-main` и `tour-screen` показывают
// `{vars.экран}`: клавиатура у экрана постоянная, а содержимое каждый раз своё. Разводить их по
// ноде на каждую справку значило бы держать пять копий одной клавиатуры и править их вместе.
//
// Подписи кнопок берём из тех же констант, что и рукописное меню: пока источников два, они обязаны
// совпадать буква в букву — по подписи кнопки едет и переход по ребру, и разбор в старом коде.
// Единственным источник станет после Э6.

import { FORMS_BUTTON } from "../tg-forms";
import { MEETING_BUTTON } from "../tg-meetings";
import { MENU } from "../tg-menu";
import { EDIT_BUTTON } from "../tg-profile";
import { REGISTER_BUTTON } from "../tg-register";
import { BACK, MY_TEAM, TEAMS, TT_EXIT } from "../tg-tournaments";
import type { BotFlowGraph, FlowButton } from "./types";

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

export const defaultFlow = (): BotFlowGraph => ({
  format: 1,
  key: FLOW_KEY,
  start: "start",
  nodes: [
    { id: "start", type: "start", title: "/start", next: MENU_NODE, x: 0, y: 0 },

    {
      id: MENU_NODE,
      type: "menu",
      title: "Главное меню",
      text: "{settings.menu}",
      x: 0,
      y: 140,
      // Кнопку регистрации прячем от того, кого лига знает: звать в лигу того, кто в ней играет,
      // значит путать.
      buttons: mainButtons({ left: "ctx.известен", op: "нет" }),
      // Непонятый текст отдаём наружу: «Мой состав» с прошлогодней клавиатуры, ответ на предложение
      // соперника и кнопки начатых диалогов ловит старый обработчик — он же ответит меню, если
      // текст непонятен и ему. После Э6 здесь встанет возврат на эту же ноду.
      else: null,
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
      else: null,
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
