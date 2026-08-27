"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/account";
import {
  addQuestion,
  createQuiz,
  deleteQuestion,
  deleteQuiz,
  moveQuestion,
  updateQuestion,
  updateQuiz,
} from "@/lib/quizzes";

// Правка анкет. Право проверяется здесь, у самой записи: страницу можно и не открывать
// (docs/archive/ACCOUNTS-PLAN.md §2.2).

export type QuizState = { error?: string; ok?: string } | null;

const list = "/admin/quizzes";
const one = (slug: string) => `${list}/${slug}`;

const options = (form: FormData): string[] =>
  String(form.get("options") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

export async function create(_prev: QuizState, form: FormData): Promise<QuizState> {
  let slug: string;
  try {
    await requirePermission("quizzes");
    const quiz = await createQuiz(String(form.get("title") ?? ""));
    slug = quiz.slug;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось создать анкету" };
  }
  // Редирект вне try: он работает через исключение, и catch выше принял бы его за ошибку.
  revalidatePath(list);
  redirect(one(slug));
}

export async function saveSettings(_prev: QuizState, form: FormData): Promise<QuizState> {
  try {
    await requirePermission("quizzes");
    const slug = String(form.get("slug") ?? "");
    const closeRaw = String(form.get("closeAt") ?? "").trim();
    await updateQuiz(Number(form.get("id")), {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? "").trim() || null,
      status: String(form.get("status") ?? "draft"),
      // Пустая строка — «без срока»: приём закрывают руками.
      closeAt: closeRaw ? new Date(closeRaw) : null,
    });
    revalidatePath(one(slug));
    revalidatePath(list);
    return { ok: "Сохранено" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось сохранить" };
  }
}

export async function saveQuestion(_prev: QuizState, form: FormData): Promise<QuizState> {
  try {
    await requirePermission("quizzes");
    const slug = String(form.get("slug") ?? "");
    const id = Number(form.get("id") ?? 0);
    const text = String(form.get("text") ?? "");
    const required = form.get("required") === "on";
    if (id) await updateQuestion(id, text, options(form), required);
    else await addQuestion(Number(form.get("quizId")), text, options(form), required);
    revalidatePath(one(slug));
    return { ok: id ? "Вопрос сохранён" : "Вопрос добавлен" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось сохранить вопрос" };
  }
}

export async function removeQuestion(form: FormData): Promise<void> {
  await requirePermission("quizzes");
  await deleteQuestion(Number(form.get("id")));
  revalidatePath(one(String(form.get("slug") ?? "")));
}

export async function moveQ(form: FormData): Promise<void> {
  await requirePermission("quizzes");
  await moveQuestion(Number(form.get("id")), form.get("dir") === "up");
  revalidatePath(one(String(form.get("slug") ?? "")));
}

/** Удаление анкеты уносит и все ответы — поэтому отдельным действием и с подтверждением в UI. */
export async function removeQuiz(form: FormData): Promise<void> {
  await requirePermission("quizzes");
  await deleteQuiz(Number(form.get("id")));
  revalidatePath(list);
  redirect(list);
}
