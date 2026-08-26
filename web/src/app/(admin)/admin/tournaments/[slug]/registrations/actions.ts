"use server";

import { revalidatePath } from "next/cache";
import { currentAccount, requirePermission } from "@/lib/account";
import { approveApplication, deleteApplication, formatDraft, parseDraft, rejectApplication } from "@/lib/team-application";
import { enrichTeam } from "@/lib/enrich";
import { notifyApproved, notifyRejected } from "@/lib/tg-notify";
import { prisma } from "@/lib/prisma";

// Решения по заявкам команд. Право проверяется здесь, у самой записи: страницу можно и не
// открывать, а отрисована она могла быть со старыми правами (docs/archive/ACCOUNTS-PLAN.md §2.2).
//
// Апрув требует ещё и `roster.edit`: он заводит команды, игроков и составы — это правка ростера,
// кто бы её ни инициировал.

export type ReviewState = { error?: string; ok?: string } | null;

const path = (slug: string) => `/admin/tournaments/${slug}/registrations`;

export async function setDivision(form: FormData): Promise<void> {
  await requirePermission("tournaments.edit");
  const raw = String(form.get("divisionId") ?? "");
  await prisma.teamApplication.update({
    where: { id: Number(form.get("id")) },
    data: { divisionId: raw ? Number(raw) : null },
  });
  revalidatePath(path(String(form.get("tournamentSlug") ?? "")));
}

export async function approve(_prev: ReviewState, form: FormData): Promise<ReviewState> {
  try {
    await requirePermission("tournaments.edit");
    await requirePermission("roster.edit");
    const me = await currentAccount();
    const id = Number(form.get("id"));
    const application = await approveApplication(id, me?.id ?? null);
    // Уведомление после записи и не в транзакции: телеграм лежит — команда всё равно заведена.
    await notifyApproved(id, parseDraft(application.payload)?.name ?? "Команда");
    revalidatePath(path(String(form.get("tournamentSlug") ?? "")));
    revalidatePath("/roster/teams");
    return { ok: "Команда заведена" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось одобрить заявку" };
  }
}

export async function reject(_prev: ReviewState, form: FormData): Promise<ReviewState> {
  try {
    await requirePermission("tournaments.edit");
    const me = await currentAccount();
    const id = Number(form.get("id"));
    const reason = String(form.get("reason") ?? "");
    const application = await rejectApplication(id, reason, me?.id ?? null);
    await notifyRejected(id, parseDraft(application.payload)?.name ?? "Команда", reason.trim());
    revalidatePath(path(String(form.get("tournamentSlug") ?? "")));
    return { ok: "Заявка возвращена" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось вернуть заявку" };
  }
}

/**
 * Дотянуть данные по заявке, уже лежащей в очереди: заявка могла приехать из бота или из файла без
 * ссылок, и обогащать её на импорте было нечего. Результат пишем обратно в payload — заявка остаётся
 * единственным местом, где живёт состав до апрува.
 */
export async function enrich(form: FormData): Promise<void> {
  await requirePermission("tournaments.edit");
  const id = Number(form.get("id"));
  const application = await prisma.teamApplication.findUnique({ where: { id } });
  const draft = application ? parseDraft(application.payload) : null;
  if (!draft) return;
  const { team } = await enrichTeam(draft);
  await prisma.teamApplication.update({ where: { id }, data: { payload: formatDraft(team) } });
  revalidatePath(path(String(form.get("tournamentSlug") ?? "")));
}

export async function remove(form: FormData): Promise<void> {
  await requirePermission("tournaments.edit");
  await deleteApplication(Number(form.get("id")));
  revalidatePath(path(String(form.get("tournamentSlug") ?? "")));
}
