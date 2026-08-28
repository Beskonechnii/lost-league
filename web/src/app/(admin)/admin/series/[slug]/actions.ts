"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/account";
import { approveMeeting, declineMeeting } from "@/lib/tg-meetings";

// Источник id матчей турнира: ссылка «куда смотреть глазами» и league_id — тикет лиги в Dota 2,
// единственный ключ, по которому матчи сезона связаны программно (см. src/lib/league-matches.ts).
// Право то же, что и у самого архива: кто заводит встречи, тот и указывает, откуда берёт номера.

export async function saveMatchesUrl(form: FormData): Promise<void> {
  await requirePermission("series.edit");

  const slug = String(form.get("slug") ?? "");
  const raw = String(form.get("matchesUrl") ?? "").trim();
  // Пустое поле — это «источника нет», а не пустая строка в БД: так проверка `matchesUrl &&`
  // на странице остаётся честной.
  const value = raw ? (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`) : null;

  // league_id: пусто — «не задан», иначе целое число. Мусор молча в null не превращаем — оператор
  // должен увидеть, что поле не сохранилось, а не гадать, почему проверка лиги не работает.
  const leagueRaw = String(form.get("leagueId") ?? "").trim();
  if (leagueRaw && !/^\d{1,10}$/.test(leagueRaw)) throw new Error("league_id — это число, например 19700");
  const leagueId = leagueRaw ? Number(leagueRaw) : null;

  await prisma.tournament.update({ where: { slug }, data: { matchesUrl: value, leagueId } });
  revalidatePath(`/admin/series/${slug}`);
}

// Предложения времени от капитанов (BOT-PLAN Э8). Право то же, что у самого архива: кто заводит
// встречи, тот и назначает им время. Апрув — единственное место, где договорённость капитанов
// становится расписанием: до него это переписка, а не `Series.startAt`.

export async function approveMeetingRequest(form: FormData): Promise<void> {
  await requirePermission("series.edit");

  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) throw new Error("Не понял, какое предложение подтверждать");

  // Рассылку обеим командам делает не эта функция, а `announceReschedule` внутри: вход у
  // уведомления «встреча назначена» один, откуда бы время ни пришло.
  const { error } = await approveMeeting(id);
  if (error) throw new Error(error);
  revalidatePath(`/admin/series/${String(form.get("slug") ?? "")}`);
}

export async function declineMeetingRequest(form: FormData): Promise<void> {
  await requirePermission("series.edit");

  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) throw new Error("Не понял, какое предложение отклонять");
  // Причина обязательна: отказ без неё оставляет капитанов гадать, что предложить взамен.
  const reason = String(form.get("reason") ?? "").trim();
  if (!reason) throw new Error("Напишите причину — её увидят оба капитана");

  const { error } = await declineMeeting(id, reason);
  if (error) throw new Error(error);
  revalidatePath(`/admin/series/${String(form.get("slug") ?? "")}`);
}
