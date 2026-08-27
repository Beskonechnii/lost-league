// Только сервер: анкеты под ивенты — те, что оператор заводит сам (`/admin/quizzes`), а бот
// задаёт в телеграме (`src/lib/tg-forms.ts`).
//
// Почему отдельно от заявки команды. Заявка завязана на модель ростера: команда, пять позиций,
// ссылки на профили, очередь модерации, запись в ростер при апруве. Анкета не пишет никуда, кроме
// своих ответов, и вопросы у неё любые — запись на шоуматч, опрос, заявка кастера. Свести их в одну
// сущность значит на каждой правке разбираться, к какому из двух случаев относится проверка.
//
// Статусы: `draft` — не видит никто, `open` — бот предлагает, `closed` — приём закрыт, ответы
// остались. Срок (`closeAt`) закрывает приём сам, как `regCloseAt` у турнира.

import { prisma } from "./prisma";
import { slugify } from "./profiles";

export type Answer = { question: string; answer: string };

/** Варианты ответа хранятся строкой (sqlite не умеет массивы) — по строке на вариант, как в `BotQuestion`. */
export const parseOptions = (raw: string | null | undefined): string[] =>
  (raw ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

export const formatOptions = (options: string[]): string | null => (options.length ? options.join("\n") : null);

/** Открыт ли приём: то же правило, что у турнира (`registrationOpen`) — статус плюс срок. */
export const quizOpen = (q: { status: string; closeAt: Date | null }): boolean =>
  q.status === "open" && (!q.closeAt || q.closeAt.getTime() > Date.now());

/** Анкеты, которые бот сейчас предлагает. Без вопросов анкету не показываем: спрашивать нечего. */
export async function openQuizzes() {
  const all = await prisma.quiz.findMany({
    where: { status: "open" },
    orderBy: { id: "asc" },
    include: { questions: { orderBy: { orderNo: "asc" } } },
  });
  return all.filter((q) => quizOpen(q) && q.questions.length > 0);
}

export const listQuizzes = () =>
  prisma.quiz.findMany({
    orderBy: [{ status: "asc" }, { id: "desc" }],
    include: { questions: { select: { id: true } }, responses: { select: { id: true } } },
  });

export const quizBySlug = (slug: string) =>
  prisma.quiz.findUnique({
    where: { slug },
    include: { questions: { orderBy: { orderNo: "asc" } } },
  });

export type QuizWithQuestions = NonNullable<Awaited<ReturnType<typeof quizBySlug>>>;

/** Свободный слаг: имя анкеты повторяется от сезона к сезону («Запись на шоуматч»). */
async function freeSlug(title: string) {
  const base = slugify(title) || "quiz";
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    if (!(await prisma.quiz.findUnique({ where: { slug } }))) return slug;
  }
}

export async function createQuiz(title: string) {
  const name = title.trim();
  if (!name) throw new Error("Укажите название анкеты");
  return prisma.quiz.create({ data: { title: name, slug: await freeSlug(name) } });
}

export async function updateQuiz(
  id: number,
  data: { title?: string; description?: string | null; status?: string; closeAt?: Date | null },
) {
  if (data.title !== undefined && !data.title.trim()) throw new Error("Название пустое");
  return prisma.quiz.update({ where: { id }, data });
}

export const deleteQuiz = (id: number) => prisma.quiz.delete({ where: { id } });

// ── вопросы ──────────────────────────────────────────────────────────────────

export async function addQuestion(quizId: number, text: string, options: string[], required: boolean) {
  if (!text.trim()) throw new Error("Вопрос пустой");
  if (options.length === 1) throw new Error("Вариантов должно быть либо ноль (свободный ответ), либо два и больше");
  const last = await prisma.quizQuestion.findFirst({ where: { quizId }, orderBy: { orderNo: "desc" } });
  return prisma.quizQuestion.create({
    data: { quizId, text: text.trim(), options: formatOptions(options), required, orderNo: (last?.orderNo ?? 0) + 1 },
  });
}

export async function updateQuestion(id: number, text: string, options: string[], required: boolean) {
  if (!text.trim()) throw new Error("Вопрос пустой");
  if (options.length === 1) throw new Error("Вариантов должно быть либо ноль (свободный ответ), либо два и больше");
  return prisma.quizQuestion.update({
    where: { id },
    data: { text: text.trim(), options: formatOptions(options), required },
  });
}

export const deleteQuestion = (id: number) => prisma.quizQuestion.delete({ where: { id } });

/** Поменять вопрос местами с соседом: порядок вопросов и есть порядок диалога. */
export async function moveQuestion(id: number, up: boolean) {
  const question = await prisma.quizQuestion.findUnique({ where: { id } });
  if (!question) return;
  const all = await prisma.quizQuestion.findMany({ where: { quizId: question.quizId }, orderBy: { orderNo: "asc" } });
  const i = all.findIndex((q) => q.id === id);
  const j = up ? i - 1 : i + 1;
  if (j < 0 || j >= all.length) return;
  await prisma.$transaction([
    prisma.quizQuestion.update({ where: { id: all[i].id }, data: { orderNo: all[j].orderNo } }),
    prisma.quizQuestion.update({ where: { id: all[j].id }, data: { orderNo: all[i].orderNo } }),
  ]);
}

// ── ответы ───────────────────────────────────────────────────────────────────

export const parseAnswers = (raw: string): Answer[] => {
  try {
    const data = JSON.parse(raw) as Answer[];
    return Array.isArray(data) ? data.filter((a) => a?.question) : [];
  } catch {
    return [];
  }
};

/**
 * Записать заполненную анкету. Один чат — одна запись на анкету: повторное прохождение правит
 * прежнюю, а не плодит строки (то же решение, что у заявки команды).
 */
export async function saveResponse(
  quizId: number,
  chatId: string,
  username: string | null,
  playerId: number | null,
  answers: Answer[],
) {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) throw new Error("Анкета не найдена");
  if (!quizOpen(quiz)) throw new Error("Приём ответов по этой анкете закрыт");

  const mine = await prisma.quizResponse.findFirst({ where: { quizId, chatId } });
  const data = { quizId, chatId, username, playerId, answers: JSON.stringify(answers), createdAt: new Date() };
  return mine
    ? prisma.quizResponse.update({ where: { id: mine.id }, data })
    : prisma.quizResponse.create({ data });
}

export const listResponses = (quizId: number) =>
  prisma.quizResponse.findMany({ where: { quizId }, orderBy: { createdAt: "desc" } });

/**
 * Ответы таблицей: колонки — вопросы анкеты, строки — люди. Ответ ищем по тексту вопроса, а не по
 * порядку: вопрос могли добавить в середину, и позиции старых ответов разъехались бы.
 */
export function responsesTable(questions: { text: string }[], responses: { username: string | null; createdAt: Date; answers: string }[]) {
  const columns = questions.map((q) => q.text);
  const rows = responses.map((r) => {
    const byQuestion = new Map(parseAnswers(r.answers).map((a) => [a.question, a.answer]));
    return {
      username: r.username,
      createdAt: r.createdAt,
      cells: columns.map((c) => byQuestion.get(c) ?? ""),
      /** Ответы на вопросы, которых в анкете уже нет, — иначе они пропали бы молча. */
      extra: parseAnswers(r.answers).filter((a) => !columns.includes(a.question)),
    };
  });
  return { columns, rows };
}
