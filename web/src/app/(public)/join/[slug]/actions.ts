"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { currentAccountId } from "@/lib/player-session";
import { registerForTournament, unregisterFromTournament, setJoinIntent, joinOpen } from "@/lib/mixcup";
import { parseRoleKeys } from "@/lib/roles";

// Server actions страницы записи (ТЗ 34, DESIGN §3) — «Участвовать»/«Отменить запись» одним
// действием, без формы с полями. Турнир резолвится заново по slug на сервере, а не берётся из
// клиента: доверяем только тому, что сейчас лежит в базе (приём мог закрыться).

async function loadTournament(slug: string) {
  return prisma.tournament.findUnique({ where: { slug }, select: { id: true, kind: true, status: true } });
}

/** Вошедший жмёт «Участвовать». Профиля не хватает (анкеты ещё нет) — уводим на /me её заполнить,
 *  намерение переживает переход (кука) и вернёт человека сюда (см. actions.ts кабинета).
 *
 *  Роли обязательны (ТЗ 38). Ни одной не отмечено — возвращаем тот же экран с `?err=roles`:
 *  ошибка поля рисуется у поля, а не тостом, и клиентского состояния ради неё форма не заводит. */
export async function joinTournament(slug: string, form: FormData): Promise<void> {
  const accountId = await currentAccountId();
  if (accountId == null) redirect("/me");

  const t = await loadTournament(slug);
  if (!t || !joinOpen(t)) {
    revalidatePath(`/join/${slug}`); // приём закрылся — просто перерисуем актуальное состояние
    return;
  }

  const roles = parseRoleKeys(form.getAll("roles").join(","));
  if (roles.length === 0) redirect(`/join/${slug}?err=roles`);

  const res = await registerForTournament(accountId, t.id, roles);
  if (!res.ok) {
    if (res.reason === "no-profile") {
      await setJoinIntent(slug);
      redirect("/me");
    }
    revalidatePath(`/join/${slug}`);
    return;
  }
  revalidatePath(`/join/${slug}`);
}

/** Отменить запись — доступно только пока приём открыт (DESIGN §3: закрытый приём кнопки не даёт,
 *  но сервер проверяет то же самое сам — «POST отвечает отказом, а не молча проходит»). */
export async function leaveTournament(slug: string): Promise<void> {
  const accountId = await currentAccountId();
  if (accountId == null) return;
  const t = await loadTournament(slug);
  if (!t || !joinOpen(t)) {
    revalidatePath(`/join/${slug}`);
    return;
  }
  await unregisterFromTournament(accountId, t.id);
  revalidatePath(`/join/${slug}`);
}
