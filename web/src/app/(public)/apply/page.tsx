import { notFound, redirect } from "next/navigation";
import { currentTournament, openForRegistration } from "@/lib/tournaments";

// Заявка подаётся в конкретный турнир (/tournaments/<slug>/apply, TOURNAMENTS-PLAN.md).
// Общий /apply — сборный пункт для тех, кто пришёл не с карточки турнира, поэтому ищем турнир,
// куда сейчас правда можно подать (`openForRegistration` — там же учтён срок приёма).
// Не нашли такого — ведём на страницу текущего турнира со сроками: она полезнее пустой формы.
export default async function ApplyRedirect() {
  const target = await openForRegistration();
  if (target) redirect(`/tournaments/${target.slug}/apply`);

  const current = await currentTournament();
  if (!current) notFound();
  redirect(`/tournaments/${current.slug}/about`);
}
