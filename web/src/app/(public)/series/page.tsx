import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { withPlural } from "@/lib/plural";
import { stripBrand } from "@/lib/tournaments";
import { SectionHeader, SITE_MAX_W } from "@/components/pouf/blocks";
import { EmptyState } from "@/components/pouf/feedback";
import { PaginationLinks } from "@/components/pouf/pagination";
import { Separator } from "@/components/pouf/separator";
import { SeriesCardStacked } from "@/components/pouf/series-card";
import { Skeleton } from "@/components/pouf/skeleton";
import { PillLink } from "@/components/pouf/tabs";
import { cutLabel } from "@/app/_components/series-brief";
import { CUTS, CUT_EMPTY, CUT_LABELS, type MatchCut } from "@/app/(home)/matches-block";
import { feedHref, loadFeed, loadRows, type SeriesMeta } from "./feed";

// Все встречи лиги одной лентой — сквозной список по всем нечерновым турнирам (ТЗ 10).
//
// Раздел L1 со своим пунктом бара: лента про все турниры разом, и жить внутри раздела про
// отдельный турнир она не может. Крошек поэтому нет — путь до неё один шаг.
//
// Состояние целиком в адресе: разрез `?m=`, турнир `?t=`, страница `?page=`. Ни одного
// клиентского стейта — ссылку на любое состояние ленты можно кинуть в чат, а пагинация ссылками
// (`PaginationLinks`, а не кнопочная `Pagination`) ещё и оставляет страницы 2…N в обходе.
//
// «Матчи» и «встречи» — разные вещи: матч это карта (`/match/<id>`), встреча — серия карт.
// Раздел называется «Встречи» везде, где о нём говорят: бар, подвал, ссылка с главной.
//
// Скелет ожидания стоит границей Suspense ВНУТРИ страницы, а не файлом `loading.tsx` у сегмента.
// Причина одна и проверяемая: `loading.tsx` начинает стрим сразу, заголовки ответа уходят до
// рендера, и `notFound()` после этого меняет только тело — `?page=999` отдавал 200 вместо 404
// (`node_modules/next/dist/docs/…/loading.md`, «Status Codes»: «Place notFound() before those
// boundaries»). Поэтому страница сперва решает, существует ли адрес, по лёгкой выборке, и только
// потом подвешивает сетку карточек.

export const dynamic = "force-dynamic";

const TITLES: Record<MatchCut, string> = {
  past: "Все встречи лиги",
  today: "Встречи сегодня",
  // На этот адрес переехало `/schedule`: запрос «расписание …» должен видеть своё слово.
  next: "Расписание встреч",
};

const DESCRIPTIONS: Record<MatchCut, string> = {
  past: "Все сыгранные встречи лиги SPIRIT/CTRL: счёт, соперники, дивизион и стадия турнира.",
  today: "Встречи лиги SPIRIT/CTRL, которые идут сегодня: кто с кем играет, во сколько и в каком дивизионе.",
  next: "Расписание ближайших встреч лиги SPIRIT/CTRL: соперники, время начала, дивизион и стадия турнира.",
};

/** Сетка одна на карточки и на скелет: два набора классов разъедутся на первой правке. */
const GRID = "grid gap-3 md:grid-cols-2 xl:grid-cols-3";

const dayTime = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const time = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

type Props = { searchParams: Promise<{ m?: string; t?: string; page?: string }> };

/**
 * Метаданные считаются из той же выборки, что рисует страницу (`loadFeed` кэширован на запрос):
 * заголовок зависит от того, какой разрез в итоге открылся, а не от того, что попросили.
 *
 * Индексация: фильтр по турниру закрыт `noindex, follow` — это подмножество той же ленты, и оно
 * конкурировало бы с собственными страницами турнира. Пустая лента закрыта по факту пустоты, а не
 * по имени разреза. Страницы 2…N каноничны сами на себя: канон на первую спрятал бы от обхода
 * пять шестых встреч. `og:url` и `og:image` не заводим — без `metadataBase` Next подставит в них
 * localhost (это блокер Б3, `docs/tasks/03-seo-bazovyi.md`).
 */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { m, t, page: p } = await searchParams;
  const feed = await loadFeed(m ?? "", t ?? "", p ?? "");
  if (!feed) return {};

  const { cut, defaultCut, picked, page, total } = feed;
  // Имя турнира на бренд-поверхность идёт только через `stripBrand`: оператор пишет «LOST»
  // и в `name`, и в `short`, а в заголовке и OG его быть не должно. Вычистилось до пустого —
  // подписывать нечем, суффикс выпадает вместе с разделителем.
  const named = picked ? stripBrand(picked.label) : "";
  const title =
    TITLES[cut] + (named ? ` · ${named}` : "") + (page > 1 ? ` · страница ${page}` : "");
  const description =
    (named
      ? `Встречи турнира ${named} в лиге SPIRIT/CTRL: счёт, соперники, дивизион и стадия.`
      : DESCRIPTIONS[cut]) + (page > 1 ? ` Страница ${page}.` : "");

  // Первая страница: умолчательный разрез схлопывается в голый `/series` — бар, подвал и ссылка
  // с главной ведут именно туда, и два адреса с одним текстом в индексе не нужны. Со второй
  // страницы канон идёт на себя вместе с разрезом.
  const canonical =
    page > 1
      ? feedHref({ cut, t: picked?.slug, page })
      : feedHref({ cut: cut === defaultCut ? undefined : cut, t: picked?.slug });

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: !picked && total > 0, follow: true },
    openGraph: { title, description, type: "website" },
  };
}

export default async function SeriesFeed({ searchParams }: Props) {
  const { m, t, page: p } = await searchParams;
  const feed = await loadFeed(m ?? "", t ?? "", p ?? "");
  if (!feed) notFound();

  const { cut, counts, tournaments, picked, ids, meta, page, pages, total } = feed;
  const empty = CUT_EMPTY[cut];

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 font-pouf md:px-6`}>
      <SectionHeader
        eyebrow="Лига"
        title="Все встречи лиги"
        aside={withPlural(total, "встреча", "встречи", "встреч")}
      />

      {/* Разрезы и турниры — один ряд, две группы через вертикальный разделитель. На узком экране
          ряд переносится: запрет §2 на второй ряд относится к бару, а не к фильтрам в теле. */}
      <div className="mt-(--s5) flex flex-wrap items-center gap-2">
        {CUTS.map((c) => (
          <PillLink
            key={c}
            href={feedHref({ cut: c, t: picked?.slug })}
            active={c === cut}
            count={counts[c]}
            scroll={false}
          >
            {CUT_LABELS[c]}
          </PillLink>
        ))}
        <Separator orientation="vertical" />
        <PillLink href={feedHref({ cut })} active={!picked} scroll={false}>
          Все турниры
        </PillLink>
        {tournaments.map((x) => (
          <PillLink
            key={x.slug}
            href={feedHref({ cut, t: x.slug })}
            active={picked?.slug === x.slug}
            title={x.name}
            scroll={false}
          >
            {x.label}
          </PillLink>
        ))}
      </div>

      {/* Якорь ленты: ссылки пагинации ведут на `#feed`, и переход ставит экран на начало списка,
          а не на шапку страницы и не в хвост новой страницы. */}
      <div id="feed" className="mt-(--s6) scroll-mt-4">
        {ids.length === 0 ? (
          <EmptyState icon="calendar" title={empty.title}>
            {picked ? (
              <Link href={feedHref({ cut })} className="underline underline-offset-4 hover:text-ink">
                Все турниры
              </Link>
            ) : (
              empty.text
            )}
          </EmptyState>
        ) : (
          <Suspense fallback={<FeedSkeleton count={ids.length} />}>
            <FeedGrid ids={ids} meta={meta} cut={cut} narrowed={!!picked} />
          </Suspense>
        )}
      </div>

      <PaginationLinks
        page={page}
        pages={pages}
        href={(n) => `${feedHref({ cut, t: picked?.slug, page: n })}#feed`}
        className="mt-(--s6)"
      />
    </main>
  );
}

/** Карточки страницы. Отдельным компонентом, потому что только они ждут тяжёлую выборку. */
async function FeedGrid({
  ids,
  meta,
  cut,
  narrowed,
}: {
  ids: number[];
  meta: Map<number, SeriesMeta>;
  cut: MatchCut;
  /** Лента сужена фильтром до одного турнира — его имя из подписи уходит. */
  narrowed: boolean;
}) {
  const rows = await loadRows(ids);

  return (
    <div className={GRID}>
      {rows.map((s) => {
        const info = meta.get(s.divisionId ?? -1);
        // Подпись от общего к частному: обрезается хвост, и на узкой колонке теряется самое
        // частное. Полная строка (с длинным именем турнира) уезжает в `title`.
        const tail = [info?.division, cutLabel(s)].filter(Boolean);
        const short = [narrowed ? null : info?.tournament, ...tail].filter(Boolean).join(" · ");
        const full = [narrowed ? null : info?.tournamentFull, ...tail].filter(Boolean).join(" · ");
        const played = s.homeScore + s.awayScore > 0;
        const when = s.playedAt ?? s.startAt;
        return (
          <SeriesCardStacked
            key={s.id}
            href={`/series/${s.slug}`}
            cut={<span title={full}>{short}</span>}
            when={
              when ? (cut === "today" ? time.format(when) : dayTime.format(when))
              : played ? undefined
              : "время не назначено"
            }
            home={{ name: s.home.name, tag: s.home.tag, logo: s.home.logo }}
            away={{ name: s.away.name, tag: s.away.tag, logo: s.away.logo }}
            homeScore={s.homeScore}
            awayScore={s.awayScore}
            played={played}
          />
        );
      })}
    </div>
  );
}

/** Ожидание ленты: те же ячейки, что у карточек (132px — три ряда по 40px плюс поля подушки). */
function FeedSkeleton({ count }: { count: number }) {
  return (
    <div role="status" aria-label="Загружаем встречи" className={GRID}>
      {Array.from({ length: Math.min(count, 6) }, (_, i) => (
        <Skeleton key={i} variant="card" className="h-[132px]" />
      ))}
    </div>
  );
}
