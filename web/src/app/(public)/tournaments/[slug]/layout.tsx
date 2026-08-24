import { notFound } from "next/navigation";
import { getDivisions, listTournaments, tournamentBySlug } from "@/lib/tournaments";
import { TournamentBar } from "@/app/_components/tournament-bar";
import { SITE_MAX_W } from "@/app/_components/ui";

// Оболочка всего, что живёт внутри турнира. Строку контекста (турнир · дивизион · этап) и колонку
// контента задаёт она одна — вложенные layout'ы больше не рисуют ни своего <main>, ни своих рядов
// вкладок. Так на любой странице турнира ровно два ряда хрома (UI-GUIDELINES §0, принцип 5), а
// раздел не может «забыть» показать соседей: они приходят сверху, а не из страницы.

export default async function TournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tournament = await tournamentBySlug(slug);
  // Черновик наружу не показываем — он и раньше отдавал 404 со страницы турнира.
  if (!tournament || tournament.status === "draft") notFound();

  const divisions = await getDivisions(tournament.id);
  // Переключатель показывает все турниры, кроме черновиков и текущего: список «куда ещё можно уйти».
  const others = (await listTournaments())
    .filter((t) => t.status !== "draft" && t.slug !== slug)
    .map((t) => ({ slug: t.slug, name: t.name, status: t.status }));

  return (
    <>
      <TournamentBar
        slug={slug}
        name={tournament.name}
        divisions={divisions.map((d) => ({ slug: d.slug, short: d.short }))}
        tournaments={others}
      />
      <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>{children}</main>
    </>
  );
}
