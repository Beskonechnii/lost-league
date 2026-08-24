import { redirect } from "next/navigation";
import { getDivisions, tournamentBySlug } from "@/lib/tournaments";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

// Адрес турнира сам по себе больше ничего не показывает — он ведёт туда, зачем на турнир и заходят:
// в таблицу первого дивизиона. Плитки дивизионов, ростера и TP, которые стояли здесь раньше,
// переехали в строку контекста (TournamentBar): она видна на каждой странице турнира, а не только
// на одной. Регламент и сроки — на вкладке «О турнире».
//
// Два исключения ведут не в таблицу, а на «О турнире»: турнир без дивизионов (заведён, жеребьёвки
// ещё нет) и турнир в приёме заявок — там таблица пустая, а нужны регламент, сроки и кнопка заявки.
export default async function TournamentHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tournament = await tournamentBySlug(slug);
  if (!tournament || tournament.status === "draft") notFound();

  const divisions = await getDivisions(tournament.id);
  const toTable = divisions[0] && tournament.status !== "registration";
  redirect(toTable ? `/tournaments/${slug}/${divisions[0]!.slug}` : `/tournaments/${slug}/about`);
}
