// Только сервер / скрипт: прохождение анкеты в телеграме — той, что оператор завёл на /admin/quizzes.
//
// Отдельно от `tg-quiz.ts` (заявка команды) по той же причине, по какой отдельны модели: у заявки
// жёсткий сценарий с проверками ростера, здесь — список произвольных вопросов подряд. Общее у них
// только хранилище диалога (`BotSession`) и форма ответа (`Reply`), поэтому шаги анкеты живут в
// своём пространстве имён (`form_*`), а `handleMessage` отдаёт их сюда.

import { prisma } from "./prisma";
import type { Reply } from "./telegram";
import {
  openQuizzes,
  parseOptions,
  saveResponse,
  type Answer,
  type QuizWithQuestions,
} from "./quizzes";

/** Шаги анкеты. Хранятся в том же `BotSession.step`, что и шаги заявки — префикс их разводит. */
export type FormStep = "form_pick" | "form_ask" | "form_confirm";

export const isFormStep = (step: string): step is FormStep => step.startsWith("form_");

/** Состояние прохождения: какая анкета и что уже отвечено. */
export type FormState = { quizId: number | null; answers: Answer[] };

export const FORMS_BUTTON = "Анкеты";
const SKIP = "Пропустить";
const SEND = "Отправить";
const RESTART = "Заполнить заново";

const column = (items: string[]): string[][] => items.map((t) => [t]);

/** Вопрос с вариантами — кнопками; необязательный можно пропустить. */
function ask(quiz: QuizWithQuestions, index: number): Reply {
  const question = quiz.questions[index];
  const options = parseOptions(question.options);
  const rows = column(options);
  if (!question.required) rows.push([SKIP]);
  return {
    text: `<b>${question.text}</b>${question.required ? "" : "\n<i>можно пропустить</i>"}`,
    keyboard: rows.length ? rows : null,
  };
}

/** Сводка: человек видит, что уходит организатору, до отправки. */
const summary = (quiz: QuizWithQuestions, state: FormState): Reply => ({
  text: [
    `<b>${quiz.title}</b>`,
    "",
    ...state.answers.map((a) => `<b>${a.question}</b>\n${a.answer}`),
    "",
    "Отправляем?",
  ].join("\n"),
  keyboard: [[SEND], [RESTART]],
});

/** Список открытых анкет. `null` — открытых нет, звать некуда. */
export async function offerForms(): Promise<Reply | null> {
  const quizzes = await openQuizzes();
  if (quizzes.length === 0) return null;
  return { text: "Что заполняем?", keyboard: column(quizzes.map((q) => q.title)) };
}

/** Есть ли что предлагать — по этому меню решает, показывать ли кнопку «Анкеты». */
export const anyFormOpen = async (): Promise<boolean> => (await openQuizzes()).length > 0;

const emptyForm = (): FormState => ({ quizId: null, answers: [] });

/** Начать анкету по названию кнопки. `null` — такой открытой анкеты нет. */
export async function startForm(title: string): Promise<{ state: FormState; step: FormStep; replies: Reply[] } | null> {
  const quiz = (await openQuizzes()).find((q) => q.title.trim().toLowerCase() === title.trim().toLowerCase());
  if (!quiz) return null;

  const state = { ...emptyForm(), quizId: quiz.id };
  const hello: Reply[] = quiz.description ? [{ text: quiz.description }] : [];
  return { state, step: "form_ask", replies: [...hello, ask(quiz, 0)] };
}

/** Анкета из состояния. Её могли закрыть или удалить, пока человек отвечал. */
const quizOf = (state: FormState) =>
  state.quizId
    ? prisma.quiz.findUnique({ where: { id: state.quizId }, include: { questions: { orderBy: { orderNo: "asc" } } } })
    : Promise.resolve(null);

/**
 * Вопрос, на котором стоит анкета: им бот отвечает на служебную кнопку, нажатую посреди заполнения
 * (`ServicePolicy` → «повторить»). `null` — анкету закрыли, пока человек отвечал: повторять нечего.
 */
export async function askForm(step: FormStep, state: FormState): Promise<Reply | null> {
  if (step === "form_pick") return offerForms();
  const quiz = await quizOf(state);
  if (!quiz) return null;
  if (step === "form_confirm") return summary(quiz, state);
  const index = state.answers.length;
  return quiz.questions[index] ? ask(quiz, index) : summary(quiz, state);
}

/** Результат шага: что ответить и куда переходить. `done` — анкета закончена, диалог сбросить. */
export type FormResult = { replies: Reply[]; step?: FormStep; state: FormState; done?: boolean };

/**
 * Шаг анкеты. Возвращает состояние наружу, а не пишет сам: хранилище диалога общее с заявкой, и
 * два писателя в одну строку — это две правды о том, где человек находится.
 */
export async function handleForm(
  step: FormStep,
  state: FormState,
  text: string,
  chatId: string,
  username: string | null | undefined,
  playerId: number | null,
): Promise<FormResult> {
  // Выбор анкеты — до загрузки: на этом шаге её ещё нет, и искать нечего.
  if (step === "form_pick") {
    const started = await startForm(text);
    if (!started) return { replies: [(await offerForms()) ?? { text: "Открытых анкет сейчас нет." }], state, step: "form_pick" };
    return { replies: started.replies, step: started.step, state: started.state };
  }

  const quiz = await quizOf(state);
  if (!quiz) {
    return { replies: [{ text: "Анкету закрыли, пока вы отвечали. Загляните в «Анкеты» — может, есть другая." }], state, done: true };
  }

  if (step === "form_ask") {
    const index = state.answers.length;
    const question = quiz.questions[index];
    // Вопрос могли удалить, пока человек отвечал: тогда просто идём к сводке, а не падаем.
    if (!question) return { replies: [summary(quiz, state)], step: "form_confirm", state };

    const options = parseOptions(question.options);
    if (text === SKIP && !question.required) {
      state.answers.push({ question: question.text, answer: "—" });
    } else {
      if (!text) return { replies: [ask(quiz, index)], step: "form_ask", state };
      if (options.length && !options.some((o) => o.toLowerCase() === text.toLowerCase())) {
        return { replies: [{ text: "Выберите один из вариантов:", keyboard: column(options) }], step: "form_ask", state };
      }
      state.answers.push({ question: question.text, answer: text });
    }

    const next = state.answers.length;
    if (next >= quiz.questions.length) return { replies: [summary(quiz, state)], step: "form_confirm", state };
    return { replies: [ask(quiz, next)], step: "form_ask", state };
  }

  // form_confirm
  if (text === RESTART) {
    state.answers = [];
    return { replies: [ask(quiz, 0)], step: "form_ask", state };
  }
  if (text !== SEND) {
    return { replies: [summary(quiz, state)], step: "form_confirm", state };
  }
  try {
    await saveResponse(quiz.id, chatId, username ?? null, playerId, state.answers);
  } catch (e) {
    // Приём мог закрыться, пока человек отвечал: ответы оставляем, чтобы не заполнял заново.
    return { replies: [{ text: `Не вышло отправить: ${e instanceof Error ? e.message : "ошибка"}` }], step: "form_confirm", state };
  }
  return { replies: [{ text: `Готово, ответы отправлены. Спасибо!` }], state, done: true };
}
