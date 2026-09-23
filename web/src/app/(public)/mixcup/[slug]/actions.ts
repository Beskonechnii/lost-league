"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { currentAccountId } from "@/lib/player-session";
import { registerForMixCup, unregisterFromMixCup, setMixCupIntent } from "@/lib/mixcup";

// Server actions страницы события (ТЗ 34, DESIGN §3) — «Участвовать»/«Отменить запись» одним
// действием, без формы с полями. Событие резолвится заново по slug на сервере, а не берётся из
// клиента: доверяем только тому, что сейчас лежит в базе (статус приёма мог смениться).

async function loadEvent(slug: string) {
  return prisma.mixCupEvent.findUnique({ where: { slug }, select: { id: true, status: true } });
}

/** Вошедший жмёт «Участвовать». Профиля не хватает (анкеты ещё нет) — уводим на /me её заполнить,
 *  намерение переживает переход (кука) и довершит запись само (см. actions.ts кабинета). */
export async function joinMixCup(slug: string): Promise<void> {
  const accountId = await currentAccountId();
  if (accountId == null) redirect("/me");

  const event = await loadEvent(slug);
  if (!event || event.status !== "open") {
    revalidatePath(`/mixcup/${slug}`); // приём закрылся — просто перерисуем актуальное состояние
    return;
  }

  const res = await registerForMixCup(accountId, event.id);
  if (!res.ok) {
    if (res.reason === "no-profile") {
      await setMixCupIntent(slug);
      redirect("/me");
    }
    revalidatePath(`/mixcup/${slug}`);
    return;
  }
  revalidatePath(`/mixcup/${slug}`);
}

/** Отменить запись — доступно только пока приём открыт (DESIGN §3: закрытый приём кнопки не даёт,
 *  но сервер проверяет то же самое сам — «POST отвечает отказом, а не молча проходит»). */
export async function leaveMixCup(slug: string): Promise<void> {
  const accountId = await currentAccountId();
  if (accountId == null) return;
  const event = await loadEvent(slug);
  if (!event || event.status !== "open") {
    revalidatePath(`/mixcup/${slug}`);
    return;
  }
  await unregisterFromMixCup(accountId, event.id);
  revalidatePath(`/mixcup/${slug}`);
}
