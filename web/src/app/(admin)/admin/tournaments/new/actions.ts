"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/account";
import { createTournament, updateTournament, tournamentBySlug } from "@/lib/tournaments";

// Экшены мастера создания турнира. Отдельно от общих `../actions.ts`, потому что здесь у каждого
// действия есть продолжение — переход на следующий шаг: мастер ведёт оператора, а не просто пишет.

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/** Поля описания — те же, что в карточке турнира; статус черновика мастер ставит сам. */
const describeInput = (form: FormData) => ({
  name: text(form, "name"),
  kind: text(form, "kind"),
  slug: text(form, "slug"),
  short: text(form, "short"),
  description: text(form, "description"),
  format: text(form, "format"),
  prize: text(form, "prize"),
  startAt: text(form, "startAt"),
  endAt: text(form, "endAt"),
  regOpenAt: text(form, "regOpenAt"),
  regCloseAt: text(form, "regCloseAt"),
});

/**
 * Шаг 1 → 2. Черновик заводится сразу, на первом же шаге: дальше у мастера есть turnир, к которому
 * можно цеплять дивизионы и составы, а прогресс живёт в БД, а не в форме — закрыл вкладку,
 * вернулся, продолжил. Статус — `draft`, пока оператор не откроет турнир сам.
 */
export async function saveDraft(form: FormData): Promise<void> {
  await requirePermission("tournaments.edit");

  const slug = text(form, "current");
  const input = { ...describeInput(form), status: "draft" };

  const tournament = slug
    ? await updateTournament(Number(form.get("id")), input)
    : await createTournament(input);

  revalidatePath("/admin/tournaments");
  // Индивидуальному формату дивизионы, импорт составов и жеребьёвка не нужны — с описания сразу
  // на «Готово», откуда «Открыть консоль» ведёт к правилам драфта и списку записавшихся (ТЗ 37).
  const next = tournament.kind === "season" ? "divisions" : "done";
  redirect(`/admin/tournaments/new/${next}?t=${tournament.slug}`);
}

/** Переход между шагами без записи: «назад», «дальше», выход в карточку. */
export async function goToStep(form: FormData): Promise<void> {
  await requirePermission("tournaments.edit");
  const step = text(form, "step");
  const slug = text(form, "t");

  // Шага без черновика не бывает (кроме первого) — иначе мастеру нечего показывать.
  if (step !== "describe" && !(await tournamentBySlug(slug))) redirect("/admin/tournaments/new/describe");

  redirect(`/admin/tournaments/new/${step}?t=${slug}`);
}

/**
 * Финиш мастера: турнир заведён. Статус не трогаем — «Приём заявок» или «Идёт» оператор включает
 * осознанно на карточке; мастер только доводит до состояния «всё заполнено». Карточка одна на
 * все форматы: у индивидуального на её месте стоит операторская консоль (ТЗ 37).
 */
export async function finishWizard(form: FormData): Promise<void> {
  await requirePermission("tournaments.edit");
  const slug = text(form, "t");
  revalidatePath("/admin/tournaments");
  revalidatePath(`/admin/tournaments/${slug}`);
  redirect(`/admin/tournaments/${slug}`);
}
