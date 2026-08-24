import { notFound, redirect } from "next/navigation";
import { currentTournament } from "@/lib/tournaments";

// Зачёт TP турнирный, поэтому переехал под адрес турнира (/tournaments/<slug>/tp). Общий /tp
// раздавался в чат — ведём его на текущий турнир, сохраняя разрез «за всё время».
export default async function TpRedirect({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await searchParams;
  const current = await currentTournament();
  if (!current) notFound();
  redirect(`/tournaments/${current.slug}/tp${all === "1" ? "?all=1" : ""}`);
}
