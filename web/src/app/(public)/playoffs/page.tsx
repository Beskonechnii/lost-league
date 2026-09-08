import { notFound, redirect } from "next/navigation";
import { currentTournament, getDivisions } from "@/lib/tournaments";

// Плей-офф турнирный, как таблица и TP: он живёт под адресом дивизиона
// (/tournaments/<турнир>/<дивизион>/playoff). Общий /playoffs стоит в подвале и раздавался
// ссылкой — ведём его на сетку текущего турнира, а не на заглушку «скоро».
// Дивизион берём первый: у сетки нет «главного» дивизиона, а из строки турнира соседний
// открывается одним нажатием.
export default async function PlayoffsRedirect() {
  const current = await currentTournament();
  if (!current) notFound();
  const [first] = await getDivisions(current.id);
  redirect(first ? `/tournaments/${current.slug}/${first.slug}/playoff` : `/tournaments/${current.slug}`);
}
