import Link from "next/link";
import { groupBySeries, listTournaments, seriesKey } from "@/lib/tournaments";
import { withPlural } from "@/lib/plural";
import { SectionHeader, SITE_MAX_W } from "@/components/pouf/blocks";
import { Breadcrumbs } from "@/components/pouf/breadcrumbs";
import { EmptyState } from "@/components/pouf/feedback";
import { PillLink } from "@/components/pouf/tabs";
import { Eyebrow } from "@/components/pouf/text";
import { TournamentRowCard } from "@/app/_components/tournament-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Хронология турниров" };

// Хронология: все нечерновые турниры лиги одной лентой по времени, включая идущий. Отдельного
// «архива прошедших» нет намеренно — иначе на сайте два списка одних и тех же турниров
// (решение по развилке 3, ТЗ 09). Раньше адрес просто редиректил на список.
//
// Разрез по серии живёт в адресе (?series=), а не в состоянии клиента: ссылку с нужной серией
// можно кинуть в чат, и «вся серия →» из раздела ведёт именно сюда.

/** Турниры без дат — последней группой, а не сверху и не вперемешку с датированными. */
const NO_DATES = "Без дат";

export default async function TournamentsArchive({
  searchParams,
}: {
  searchParams: Promise<{ series?: string }>;
}) {
  const { series } = await searchParams;
  // Пустое `?series=` — это разрез «Прочие турниры» (у них серии нет), а не отсутствие разреза:
  // фильтр задан ровно тогда, когда параметр есть в адресе.
  const picked = series === undefined ? null : seriesKey(series);

  const all = await listTournaments();
  const tournaments = all.filter((t) => t.status !== "draft");
  const groups = groupBySeries(tournaments);
  const shown = picked === null ? tournaments : tournaments.filter((t) => seriesKey(t.series) === picked);

  // Годы от свежего вниз; внутри года порядок уже задан выборкой (`startAt desc`).
  const years = new Map<string, typeof shown>();
  for (const t of shown) {
    const key = t.startAt ? String(t.startAt.getFullYear()) : NO_DATES;
    years.set(key, [...(years.get(key) ?? []), t]);
  }
  const dated = [...years.keys()].filter((y) => y !== NO_DATES).sort((a, b) => Number(b) - Number(a));
  const order = years.has(NO_DATES) ? [...dated, NO_DATES] : dated;

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <Breadcrumbs items={[{ href: "/tournaments", label: "Турниры" }]} className="mb-3" />
      <SectionHeader
        eyebrow="Лига"
        title="Хронология турниров"
        aside={withPlural(shown.length, "турнир", "турнира", "турниров")}
      />

      {groups.length > 1 && (
        <nav className="mt-(--s5) flex flex-wrap gap-2">
          <PillLink href="/tournaments/archive" active={picked === null} count={tournaments.length} scroll={false}>
            Все
          </PillLink>
          {groups.map((g) => (
            <PillLink
              key={g.key}
              href={`/tournaments/archive?series=${encodeURIComponent(g.key)}`}
              active={picked === g.key}
              count={g.items.length}
              scroll={false}
            >
              {g.title}
            </PillLink>
          ))}
        </nav>
      )}

      {shown.length === 0 ? (
        <div className="mt-(--s6)">
          <EmptyState icon="trophy" title={picked === null ? "Турниров пока нет" : "В этой серии турниров нет"}>
            {picked !== null ? (
              <Link href="/tournaments/archive" className="underline underline-offset-4 hover:text-ink">
                Все турниры
              </Link>
            ) : (
              "Турнир появляется на сайте, когда его открывают на приём заявок — до этого он рабочая заготовка организатора."
            )}
          </EmptyState>
        </div>
      ) : (
        <div className="mt-(--s6) space-y-(--s5)">
          {order.map((year) => (
            <section key={year}>
              <Eyebrow>{year}</Eyebrow>
              <ul className="mt-2 space-y-2">
                {(years.get(year) ?? []).map((t) => (
                  <li key={t.id}>
                    <TournamentRowCard t={t} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
