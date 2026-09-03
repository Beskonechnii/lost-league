// Только сервер / скрипт: реестр модулей — что нода `subflow` умеет отдать рукописному коду целиком.
// Действие (`actions.ts`) отвечает одним экраном и возвращает управление сразу; модуль забирает
// разговор себе на несколько ходов — пока не скажет «готово».
//
// **Обёртка, а не переписывание.** Повезло: все рукописные модули уже одной формы —
// `startX() → { replies, step, state, done }` и `handleX(text, step, state) → то же`
// (`tg-register.ts`, `tg-profile.ts`, `tg-meetings.ts`, `tg-forms.ts`). Это ровно контракт ноды
// `subflow`, поэтому здесь только перевод их результата в три исхода графа и обратно.
//
// **Два выхода вместо трёх состояний.** «Отменено» здесь значит **модуль не взялся за работу**:
// правки профиля нет у того, кого лига не знает; встречу не заказать не-капитану; открытых анкет
// может не быть вовсе. Прерывание уже начатого диалога (кнопка «Отмена», /cancel) модули не
// отличают от нормального конца — у всех у них это один и тот же `done: true`, — и выдумывать
// разницу снаружи значило бы врать графу. Понадобится настоящее «отменено» посреди диалога —
// это правка самих модулей, отдельной работой.
//
// **Состояние модуля живёт в той же строке `BotSession`,** в поле `state`, под ключом `sub`
// (`run.ts` → `savePark`): у графа там своих данных нет, а два хранилища на один разговор — это две
// правды о том, где человек стоит.

import type { Reply } from "../telegram";
import { askForm, handleForm, offerForms, isFormStep, type FormState } from "../tg-forms";
import {
  answerProposal,
  askMeeting,
  emptyMeeting,
  handleMeeting,
  isMrStep,
  startMeeting,
  type MrState,
} from "../tg-meetings";
import { identify } from "../tg-menu";
import { askEdit, emptyEdit, handleProfileEdit, isPeStep, startProfileEdit, type PeState } from "../tg-profile";
import { askReg, emptyRegistration, handleRegister, isRegStep, startRegistration, type RegState } from "../tg-register";
import type { FlowMessage } from "./context";

/**
 * Где стоит модуль: его собственный шаг и его собственное состояние. Граф в них не заглядывает —
 * он только возит их между сообщениями, поэтому `state` здесь `unknown`, а не общий тип.
 */
export type SubflowPark = { step: string; state: unknown };

/**
 * Чем кончился ход модуля.
 * `wait` — разговор остался у него, `done`/`cancel` — вернулся графу по соответствующему выходу.
 */
export type SubflowResult =
  | { kind: "wait"; replies: Reply[]; park: SubflowPark }
  | { kind: "done"; replies: Reply[] }
  | { kind: "cancel"; replies: Reply[] };

/** Что модуль получает: сообщение, параметры ноды (уже с подстановками) и переменные диалога. */
export type SubflowInput = {
  msg: FlowMessage;
  params: Record<string, string>;
  vars: Record<string, string>;
};

export type Subflow = {
  /** Подпись в инспекторе редактора. */
  label: string;
  /** Одна фраза «что делает» — её видно в инспекторе ноды. */
  hint?: string;
  /** Какие параметры нода может задать. Значения — с подстановками: `{vars.турнир_id}`. */
  params?: string[];
  /** Взять разговор себе. `cancel` — не взялся: причину модуль объясняет сам, словами. */
  start: (input: SubflowInput) => Promise<SubflowResult>;
  /** Очередной ход внутри модуля. */
  step: (input: SubflowInput & { park: SubflowPark }) => Promise<SubflowResult>;
  /**
   * Повторить вопрос, на котором модуль стоит. Нужен политике «повторить» (`ServicePolicy`):
   * служебная кнопка не должна ни попасть в ответ, ни оставить человека без понимания, чего от
   * него ждут. `null` — повторять нечего.
   */
  ask?: (park: SubflowPark) => Promise<Reply | null>;
};

/** Результат рукописного модуля — ровно в том виде, в каком его отдают все четыре. */
type ModuleResult<S> = { replies: Reply[]; step?: string; state: S; done?: boolean };

/**
 * Перевод результата модуля в исход графа. `at` — на каком шаге модуль стоял: у `handleX` поле
 * `step` необязательное и значит «остались там же», а графу надо знать, что записать в сессию.
 */
function resume<S>(result: ModuleResult<S>, at: string): SubflowResult {
  if (result.done) return { kind: "done", replies: result.replies };
  return { kind: "wait", replies: result.replies, park: { step: result.step ?? at, state: result.state } };
}

/** То же для входа в модуль: сразу `done` значит «не взялся» — это выход «отменено». */
function enter<S>(result: ModuleResult<S>): SubflowResult {
  if (result.done || !result.step) return { kind: "cancel", replies: result.replies };
  return { kind: "wait", replies: result.replies, park: { step: result.step, state: result.state } };
}

/**
 * Шаг, которого модуль не знает: документ графа правили руками, или сессия пережила правку кода.
 * Возвращаем разговор графу по выходу «отменено» — молча продолжать с чужим шагом хуже.
 */
const lostStep = (): SubflowResult => ({
  kind: "cancel",
  replies: [{ text: "Диалог потерялся по дороге — начнём сначала." }],
});

/** Номер турнира из параметра ноды: им сужается выбор встречи. Пусто — все турниры капитана. */
function tournamentId(params: Record<string, string>): number | undefined {
  const id = Number(params.турнир);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

/** Модули по именам. Имя лежит в документе графа (`SubflowNode.flow`). */
export const FLOW_SUBFLOWS: Record<string, Subflow> = {
  регистрация: {
    label: "Регистрация в лиге",
    hint: "Анкета игрока на вступление: десять вопросов и очередь модерации. Отменено — человек уже в лиге или анкета уже ждёт решения.",
    start: async ({ msg }) => enter(await startRegistration(msg.tgId ?? null, msg.username ?? null)),
    step: async ({ msg, park }) => {
      if (!isRegStep(park.step)) return lostStep();
      const state = (park.state as RegState | null) ?? emptyRegistration();
      const done = await handleRegister(park.step, state, msg.text, {
        chatId: msg.chatId,
        tgId: msg.tgId ?? null,
        username: msg.username,
      });
      return resume(done, park.step);
    },
    ask: async ({ step, state }) =>
      isRegStep(step) ? askReg(step, (state as RegState | null) ?? emptyRegistration()) : null,
  },

  правка_профиля: {
    label: "Правка своего профиля",
    hint: "Заявка на изменение анкеты игрока (ник, фото, ссылки). Отменено — профиль заведён не через бота, править нечего.",
    start: async ({ msg }) => enter(await startProfileEdit(msg.tgId ?? null)),
    step: async ({ msg, park }) => {
      if (!isPeStep(park.step)) return lostStep();
      const state = (park.state as PeState | null) ?? emptyEdit();
      // Фото приезжает не текстом, а `file_id` вложения — правка портрета ждёт именно его.
      const done = await handleProfileEdit(park.step, state, msg.text, {
        chatId: msg.chatId,
        tgId: msg.tgId ?? null,
        photoFileId: msg.photoFileId ?? null,
      });
      return resume(done, park.step);
    },
    ask: async ({ step, state }) => (isPeStep(step) ? askEdit(step, (state as PeState | null) ?? emptyEdit()) : null),
  },

  заказ_встречи: {
    label: "Заказ встречи",
    hint: "Капитан выбирает серию, дату и время, соперник получает предложение. Отменено — человек не капитан или назначать нечего.",
    params: ["турнир"],
    start: async ({ msg, params }) => enter(await startMeeting(msg.tgId ?? null, tournamentId(params))),
    step: async ({ msg, park }) => {
      if (!isMrStep(park.step)) return lostStep();
      const state = (park.state as MrState | null) ?? emptyMeeting();
      const done = await handleMeeting(park.step, state, msg.text, { chatId: msg.chatId, tgId: msg.tgId ?? null });
      return resume(done, park.step);
    },
    ask: async ({ step, state }) =>
      isMrStep(step) ? askMeeting(step, (state as MrState | null) ?? emptyMeeting()) : null,
  },

  анкета: {
    label: "Анкеты",
    hint: "Выбор открытой анкеты и ответы на её вопросы. Отменено — открытых анкет сейчас нет.",
    start: async () => {
      // У анкет нет своей `startX`: выбор анкеты — это первый её шаг (`form_pick`), а до него
      // нужен список. Пустой список и есть «не взялся».
      const offer = await offerForms();
      if (!offer) return { kind: "cancel", replies: [{ text: "Открытых анкет сейчас нет." }] };
      return { kind: "wait", replies: [offer], park: { step: "form_pick", state: { quizId: null, answers: [] } } };
    },
    step: async ({ msg, park }) => {
      if (!isFormStep(park.step)) return lostStep();
      const state = (park.state as FormState | null) ?? { quizId: null, answers: [] };
      // Кто отвечает: если человека знаем, ответ будет подписан игроком, а не только хендлом.
      const [playerId] = await identify(msg.chatId, msg.username, msg.tgId);
      const done = await handleForm(park.step, state, msg.text, msg.chatId, msg.username, playerId ?? null);
      return resume(done, park.step);
    },
    ask: async ({ step, state }) =>
      isFormStep(step) ? askForm(step, (state as FormState | null) ?? { quizId: null, answers: [] }) : null,
  },

  ответ_сопернику: {
    label: "Ответ на предложение соперника",
    hint:
      "«Принять время» и «Предложить другое» из уведомления. Приходят вне разговора — клавиатуру " +
      "поставило само уведомление, поэтому подписи объявлены точкой входа флоу, а не кнопками экрана.",
    // Разбор ответа и есть весь модуль: «принять» кончается сразу, «предложить другое» уводит в те
    // же шаги `mr_*`, что и обычный заказ встречи, — поэтому и `step`, и `ask` у них общие.
    start: async ({ msg }) => enter(await answerProposal(msg.text, { tgId: msg.tgId ?? null })),
    step: async ({ msg, park }) => {
      if (!isMrStep(park.step)) return lostStep();
      const state = (park.state as MrState | null) ?? emptyMeeting();
      const done = await handleMeeting(park.step, state, msg.text, { chatId: msg.chatId, tgId: msg.tgId ?? null });
      return resume(done, park.step);
    },
    ask: async ({ step, state }) =>
      isMrStep(step) ? askMeeting(step, (state as MrState | null) ?? emptyMeeting()) : null,
  },
};
