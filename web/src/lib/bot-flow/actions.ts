// Только сервер / скрипт: реестр нативных действий — что нода `action` умеет позвать в TS. Граф
// ведёт навигацию, действия делают работу: опознать человека, собрать карточку профиля, выдать код
// входа, показать состав.
//
// **Действие — обёртка, а не вторая реализация.** Внутри зовётся то же, что зовёт рукописный путь
// (`tg-menu.ts`, `tg-tournaments.ts`, `tg-login.ts`); здесь только перевод результата в переменные
// графа. Две правды об одном экране разъехались бы на первой же правке текста.
//
// **Текст — действию, клавиатура — графу.** Действие кладёт содержимое экрана в `vars.экран`, а
// кнопки рисует нода, на которой диалог заснёт. Поэтому один ответ бота, а не два: сначала справка,
// потом отдельное «что дальше».
//
// **Списки, которых граф не знает заранее** (турниры, команды), возвращаются рядами кнопок в
// `keyboard`: их подписи приходят из базы, и статическими кнопками ноды их не описать. Ряды
// достаются ближайшей ждущей ноде и встают над её собственными кнопками (`run.ts` → `speak`).

import type { Reply } from "../telegram";
import { profileCard, loginCodeText } from "../tg-menu";
import { flowApply, flowMyTeam, flowTeamCard, flowTeams, flowTournament, flowTournaments } from "../tg-tournaments";
import type { FlowMessage } from "./context";

/** Что действие получает: сообщение, параметры ноды (уже с подстановками) и переменные диалога. */
export type ActionInput = {
  msg: FlowMessage;
  params: Record<string, string>;
  vars: Record<string, string>;
  /**
   * Холостой прогон: граф гоняет симулятор редактора, живого человека на том конце нет. Читать
   * базу можно и нужно (иначе проверка условий была бы игрой в угадайку), а вот **писать нельзя**:
   * прогон не должен выдавать настоящих кодов входа и класть заявки в очередь.
   */
  dry: boolean;
};

/**
 * Что действие возвращает: реплики бота, новые переменные и по какому выходу идти дальше.
 * `ok: false` — не «упало», а «не получилось»: у ноды для этого есть выход `ошибка`. Настоящее
 * падение остаётся исключением — его ловит интерпретатор.
 */
export type ActionResult = {
  ok: boolean;
  replies?: Reply[];
  vars?: Record<string, string>;
  /** Ряды кнопок для ближайшей ждущей ноды: список из базы, которого граф не знает заранее. */
  keyboard?: string[][];
};

export type FlowAction = {
  /** Подпись в палитре редактора. */
  label: string;
  /** Одна фраза «что делает» — её видно в инспекторе ноды. */
  hint?: string;
  /** Какие параметры нода обязана задать. Значения — с подстановками: `{vars.турнир_id}`. */
  params?: string[];
  /** Что кладёт в `vars.*` — валидатору, чтобы он знал про эти имена. */
  provides?: string[];
  run: (input: ActionInput) => Promise<ActionResult>;
};

/** Логическое значение в переменных — словом: условия в графе оператор пишет руками. */
const yesNo = (value: boolean): string => (value ? "да" : "нет");

/** Кто спрашивает — в том виде, в каком это ждут справки бота. */
const who = (msg: FlowMessage) => ({ chatId: msg.chatId, username: msg.username, tgId: msg.tgId });

/** Номер турнира из параметра ноды. `null` — параметр пуст или подстановка не сработала. */
function tournamentId(params: Record<string, string>): number | null {
  const id = Number(params.турнир);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Турнир из параметра потерялся — экран об этом и говорит, а граф уводит по выходу «ошибка». */
const NO_TOURNAMENT = { ok: false, vars: { экран: "Турнир куда-то делся — выберите его заново." } };

/** Действия по именам. Имя лежит в документе графа (`ActionNode.action`). */
export const FLOW_ACTIONS: Record<string, FlowAction> = {
  профиль: {
    label: "Личный профиль",
    hint: "Карточка игрока: анкета, команда, TP и ссылки. Ошибка — лига человека не знает.",
    provides: ["экран", "правка", "вход", "новичок"],
    run: async ({ msg }) => {
      const card = await profileCard(msg.chatId, msg.username, msg.tgId);
      return {
        ok: card.known,
        vars: {
          экран: card.text,
          правка: yesNo(card.canEdit),
          вход: yesNo(card.canLogin),
          // Звать в лигу того, у кого анкета уже на проверке, — путать его: кабинет у него есть,
          // не хватает только решения организатора.
          новичок: yesNo(!card.known && !card.canLogin),
        },
      };
    },
  },

  код_входа: {
    label: "Код входа на сайт",
    hint: "Выдаёт одноразовый код кабинета. Ошибка — аккаунта под этот телеграм нет.",
    provides: ["экран", "новичок"],
    run: async ({ msg, dry }): Promise<ActionResult> => {
      // Единственное действие, которое пишет в базу: код — строка в `LoginCode`. В прогоне
      // редактора его не выдаём, иначе симулятор раздавал бы настоящие ключи от кабинета.
      if (dry) {
        return {
          ok: true,
          vars: { экран: "Здесь бот выдаёт одноразовый код входа. В прогоне код не выдаётся — база не трогается." },
        };
      }
      const code = await loginCodeText(msg.chatId, msg.username, msg.tgId);
      return { ok: code.issued, vars: { экран: code.text, новичок: yesNo(!code.issued && !code.known) } };
    },
  },

  турниры: {
    label: "Список турниров",
    hint: "Приём заявок, идущие и три последних. Кнопки с названиями. Ошибка — турниров нет.",
    provides: ["экран"],
    run: async () => {
      const list = await flowTournaments();
      return { ok: list.rows.length > 0, vars: { экран: list.text }, keyboard: list.rows };
    },
  },

  турнир: {
    label: "Открыть турнир",
    hint: "Ищет турнир по названию с кнопки и показывает его карточку. Ошибка — такого нет.",
    params: ["имя"],
    provides: ["экран", "турнир_id", "заявка", "встреча"],
    run: async ({ msg, params }) => {
      const found = await flowTournament(params.имя ?? "", msg.tgId);
      if (!found) return { ok: false };
      return {
        ok: true,
        vars: {
          экран: found.text,
          турнир_id: String(found.id),
          заявка: yesNo(found.open),
          встреча: yesNo(found.meeting),
        },
      };
    },
  },

  мой_состав: {
    label: "Мой состав в турнире",
    hint: "Состав и поданные заявки в выбранном турнире. Ошибка — лига человека не знает.",
    params: ["турнир"],
    provides: ["экран", "новичок"],
    run: async ({ msg, params }) => {
      const id = tournamentId(params);
      if (!id) return NO_TOURNAMENT;
      const mine = await flowMyTeam(id, who(msg));
      if (!mine) return NO_TOURNAMENT;
      // «Лига вас не знает» и «знаем, но в этом турнире не заявлены» — разные ответы: первому
      // экран справки предложит регистрацию, второму — нет.
      return { ok: mine.known, vars: { экран: mine.text, новичок: yesNo(!mine.known) } };
    },
  },

  команды: {
    label: "Команды турнира",
    hint: "Список команд по дивизионам, кнопки с названиями. Ошибка — команд ещё нет.",
    params: ["турнир"],
    provides: ["экран"],
    run: async ({ params }) => {
      const id = tournamentId(params);
      if (!id) return NO_TOURNAMENT;
      const teams = await flowTeams(id);
      if (!teams) return NO_TOURNAMENT;
      return { ok: teams.rows.length > 0, vars: { экран: teams.text }, keyboard: teams.rows };
    },
  },

  команда: {
    label: "Карточка команды",
    hint: "Состав, средний MMR и капитан. Ошибка — команды с таким названием в турнире нет.",
    params: ["турнир", "имя"],
    provides: ["экран"],
    run: async ({ params }) => {
      const id = tournamentId(params);
      if (!id) return NO_TOURNAMENT;
      const card = await flowTeamCard(id, params.имя ?? "");
      // Не нашли — вернёмся к списку: он сам покажет и текст, и кнопки заново.
      if (!card) return { ok: false };
      return { ok: true, vars: { экран: card.text }, keyboard: card.rows };
    },
  },

  // Состав собирается на сайте, и это единственный путь: пошаговый ввод ников в чате удалён на Э6
  // вместе со всем старым квизом. Здесь только ссылка и проверка, открыт ли приём.
  заявка: {
    label: "Подать заявку",
    hint: "Ссылка на сборку состава на сайте. Ошибка — приём заявок закрыт.",
    params: ["турнир"],
    provides: ["экран"],
    run: async ({ params }) => {
      const id = tournamentId(params);
      if (!id) return NO_TOURNAMENT;
      const apply = await flowApply(id);
      if (!apply) return NO_TOURNAMENT;
      return { ok: apply.open, vars: { экран: apply.text } };
    },
  },
};
