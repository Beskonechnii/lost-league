"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { isQuizKey, QUIZ_SLOTS } from "@/lib/quiz-config";

// Правка вопросов телеграм-бота. Право проверяется здесь, у самой записи: страницу можно и не
// открывать, а отрисована она могла быть со старыми правами (docs/archive/ACCOUNTS-PLAN.md §2.2).
// Отдельного права у бота нет — квиз это приём заявок, то же `tournaments.edit`.
//
// В таблицу пишем только отличия от дефолта (`quiz-config.ts`): текст, равный исходному, стирает
// строку, а не хранит копию. Иначе «вернуть исходный» пришлось бы отличать от «оператор написал
// ровно то же самое», и правка дефолта в коде не доезжала бы до тех, кто ничего не менял.

const PATH = "/admin/bot";

export type BotState = { error?: string; ok?: string } | null;

/** Текст встроенного шага. Совпал с дефолтом — правку убираем. */
export async function saveText(_prev: BotState, form: FormData): Promise<BotState> {
  try {
    await requirePermission("tournaments.edit");
    const key = String(form.get("key") ?? "");
    if (!isQuizKey(key)) return { error: "Неизвестный шаг" };
    const text = String(form.get("text") ?? "").trim();
    if (!text) return { error: "Текст пустой — бот не может промолчать" };

    const slot = QUIZ_SLOTS.find((s) => s.key === key)!;
    const existing = await prisma.botQuestion.findUnique({ where: { key } });
    if (text === slot.text) {
      // Выключатель живёт в той же строке — если он не в дефолте, строку не сносим.
      if (existing && !existing.enabled) await prisma.botQuestion.update({ where: { key }, data: { text } });
      else if (existing) await prisma.botQuestion.delete({ where: { key } });
    } else {
      await prisma.botQuestion.upsert({ where: { key }, create: { key, text }, update: { text } });
    }
    revalidatePath(PATH);
    return { ok: `Сохранено: ${slot.label}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось сохранить" };
  }
}

/** Спрашивать ли необязательный шаг. */
export async function toggleStep(form: FormData): Promise<void> {
  await requirePermission("tournaments.edit");
  const key = String(form.get("key") ?? "");
  const slot = QUIZ_SLOTS.find((s) => s.key === key);
  if (!slot?.optional) return;
  const enabled = form.get("enabled") === "1";
  await prisma.botQuestion.upsert({
    where: { key },
    create: { key, text: slot.text, enabled },
    update: { enabled },
  });
  revalidatePath(PATH);
}

/** Свой вопрос: добавить либо переписать существующий. */
export async function saveCustom(_prev: BotState, form: FormData): Promise<BotState> {
  try {
    await requirePermission("tournaments.edit");
    const text = String(form.get("text") ?? "").trim();
    if (!text) return { error: "Вопрос пустой" };
    const options = String(form.get("options") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    // Один вариант ответа — это не выбор, а тупик: кнопка есть, а альтернативы нет.
    if (options.length === 1) return { error: "Вариантов ответа должно быть либо ноль (свободный ответ), либо два и больше" };

    const key = String(form.get("key") ?? "");
    const data = { text, options: options.length ? options.join("\n") : null };
    if (key) {
      await prisma.botQuestion.update({ where: { key }, data });
    } else {
      // Ключ свой, не подпись: подпись оператор перепишет, а ключом связаны заявки в работе.
      const last = await prisma.botQuestion.findFirst({ where: { custom: true }, orderBy: { orderNo: "desc" } });
      await prisma.botQuestion.create({
        data: { key: `cq-${Date.now().toString(36)}`, custom: true, orderNo: (last?.orderNo ?? 0) + 1, ...data },
      });
    }
    revalidatePath(PATH);
    return { ok: key ? "Вопрос сохранён" : "Вопрос добавлен" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось сохранить вопрос" };
  }
}

/** Спрашивать ли свой вопрос. Выключенный остаётся на экране — его вернут к следующему сезону. */
export async function toggleCustom(form: FormData): Promise<void> {
  await requirePermission("tournaments.edit");
  await prisma.botQuestion.update({
    where: { key: String(form.get("key") ?? "") },
    data: { enabled: form.get("enabled") === "1" },
  });
  revalidatePath(PATH);
}

/** Удалить свой вопрос. Уже поданные заявки не трогаем: ответ хранится в них текстом вопроса. */
export async function deleteCustom(form: FormData): Promise<void> {
  await requirePermission("tournaments.edit");
  await prisma.botQuestion.deleteMany({ where: { key: String(form.get("key") ?? ""), custom: true } });
  revalidatePath(PATH);
}

/** Поменять местами с соседом — порядок вопросов задаёт порядок в диалоге. */
export async function moveCustom(form: FormData): Promise<void> {
  await requirePermission("tournaments.edit");
  const key = String(form.get("key") ?? "");
  const up = form.get("dir") === "up";
  const all = await prisma.botQuestion.findMany({ where: { custom: true }, orderBy: { orderNo: "asc" } });
  const i = all.findIndex((q) => q.key === key);
  const j = up ? i - 1 : i + 1;
  if (i === -1 || j < 0 || j >= all.length) return;
  await prisma.$transaction([
    prisma.botQuestion.update({ where: { key: all[i].key }, data: { orderNo: all[j].orderNo } }),
    prisma.botQuestion.update({ where: { key: all[j].key }, data: { orderNo: all[i].orderNo } }),
  ]);
  revalidatePath(PATH);
}
