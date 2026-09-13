import Link from "next/link";
import { currentTournament, groupBySeries, listTournaments } from "@/lib/tournaments";
import { withPlural } from "@/lib/plural";
import { SectionHeader, SITE_MAX_W } from "@/components/pouf/blocks";
import { Grid } from "@/components/pouf/layout";
import { Heading, Text } from "@/components/pouf/text";
import { EmptyState } from "@/components/pouf/feedback";
import { TournamentCard } from "@/app/_components/tournament-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Турниры" };

// Раздел «Турниры»: лицо (идущий турнир) и группы по сериям. Серия — свободное поле у турнира
// (решение Стаса 13.09.2026), группировка идёт по нормализованному значению, порядок групп задаёт
// `groupBySeries` в src/lib/tournaments.ts. Черновики не показываем: турнир становится виден,
// когда его открыли на заявки — до этого он рабочая заготовка оператора, а не событие лиги.
//
// Хронология всех турниров — своей страницей, /tournaments/archive: раздел отвечает за «что сейчас
// и что за серии», лента — за «что когда было».

/** Больше шести карточек в группе — остальное открывается по ссылке «вся серия». */
const MAX_IN_GROUP = 6;

export default async function TournamentsIndex() {
  const [all, current] = await Promise.all([listTournaments(), currentTournament()]);
  const tournaments = all.filter((t) => t.status !== "draft");

  // Лицо раздела — тот турнир, что вернул `currentTournament()`. В своей группе он повторно не
  // рисуется: две карточки с одним адресом и одним статусом на экране — второй вход в то же место.
  const head = tournaments.find((t) => t.id === current?.id) ?? null;
  const groups = groupBySeries(tournaments);

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <SectionHeader
        eyebrow="Лига"
        title="Турниры"
        aside={
          tournaments.length > 0 ? (
            <Link href="/tournaments/archive" className="hover:text-ink">
              Хронология →
            </Link>
          ) : undefined
        }
      />

      {tournaments.length === 0 && (
        <div className="mt-(--s6)">
          <EmptyState icon="trophy" title="Турниров пока нет">
            Турнир появляется на сайте, когда его открывают на приём заявок — до этого он рабочая
            заготовка организатора.
          </EmptyState>
        </div>
      )}

      {head && (
        <section className="mt-(--s6)">
          <Text muted size="sm">Сейчас в лиге</Text>
          <div className="mt-2">
            <TournamentCard t={head} face />
          </div>
        </section>
      )}

      {groups.map((g) => {
        // Счётчик считает ВСЕ турниры серии, включая вынесенный в лицо: он про серию, а не про то,
        // сколько карточек поместилось ниже.
        const items = g.items.filter((t) => t.id !== head?.id);
        if (items.length === 0) return null;
        return (
          <section key={g.key} className="mt-(--s6)">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Heading level={2}>{g.title}</Heading>
                <Text muted size="sm">{withPlural(g.items.length, "турнир", "турнира", "турниров")}</Text>
              </div>
              {g.items.length > MAX_IN_GROUP && (
                <Link
                  href={`/tournaments/archive?series=${encodeURIComponent(g.key)}`}
                  className="font-pouf text-sm font-bold text-muted hover:text-ink"
                >
                  вся серия →
                </Link>
              )}
            </div>

            <div className="mt-(--s4)">
              <Grid cols={2} gap={5}>
                {items.slice(0, MAX_IN_GROUP).map((t) => (
                  <TournamentCard key={t.id} t={t} />
                ))}
              </Grid>
            </div>
          </section>
        );
      })}
    </main>
  );
}
