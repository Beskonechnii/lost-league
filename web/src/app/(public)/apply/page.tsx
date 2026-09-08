import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentTournament, registrationOpen } from "@/lib/tournaments";

// Заявка подаётся в конкретный турнир (/tournaments/<slug>/apply, TOURNAMENTS-PLAN.md).
// Общий /apply — сборный пункт для тех, кто пришёл не с карточки турнира, поэтому ищем турнир,
// куда сейчас правда можно подать: приём заявок идёт не у «текущего» (тот обычно уже играется),
// а у следующего. Открытость считает `registrationOpen` — одно место правды, срок в нём учтён.
// Не нашли такого — ведём на страницу текущего турнира со сроками: она полезнее пустой формы.
export default async function ApplyRedirect() {
  const open = await prisma.tournament.findMany({
    where: { status: "registration" },
    orderBy: [{ startAt: "asc" }, { id: "asc" }],
  });
  const target = open.find(registrationOpen);
  if (target) redirect(`/tournaments/${target.slug}/apply`);

  const current = await currentTournament();
  if (!current) notFound();
  redirect(`/tournaments/${current.slug}/about`);
}
