import { redirect } from "next/navigation";

// Отдельного архива сезонов нет и к релизу не планируется: список турниров и так делится на
// текущий и остальные (/tournaments). Адрес оставлен живым — он стоял в подвале.
export default function TournamentsArchiveRedirect() {
  redirect("/tournaments");
}
