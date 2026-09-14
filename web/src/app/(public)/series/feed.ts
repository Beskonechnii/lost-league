import { cache } from "react";
import { listSeries, listSeriesBrief, type SeriesRow } from "@/lib/series";
import { listTournaments } from "@/lib/tournaments";
import { CUTS, isMatchCut, splitCuts, type MatchCut } from "@/app/(home)/matches-block";

// Данные сквозной ленты встреч — отдельно от страницы, потому что их спрашивают трижды: сама
// страница, её сетка карточек и `generateMetadata` (заголовок и канон зависят от того, какой
// разрез в итоге открылся и сколько в нём страниц). `cache` держит один заход в базу на запрос —
// ключ по примитивам, поэтому аргументы строками, а не объектом.
//
// Два захода, а не один. `loadFeed` считает разрез и страницы по ЛЁГКОМУ срезу (шесть полей на
// встречу) и решает, существует ли адрес; `loadRows` берёт полные строки только для двадцати
// показанных. Так, во-первых, решение про 404 принимается до первой границы Suspense — иначе
// заголовки ответа уже отправлены и статус не поменять (`next/dist/docs`, loading.js → Status
// Codes); во-вторых, лига в сотню встреч не резолвит две сотни лого с диска ради одной страницы.
//
// Разрез считается В ПАМЯТИ, одной функцией с главной (`splitCuts`): правило «прошедшие / сегодня
// / будущие» смешивает счёт и время, и второе его написание на SQL разъехалось бы с первым. Тогда
// «сколько всего страниц» считалось бы иначе, чем сама страница, и последняя выходила бы пустой.

export const PAGE_SIZE = 20;

/** Чей это турнир и дивизион — сама `Series` знает только дивизион, а ленте нужен и турнир. */
export type SeriesMeta = { tournament: string; tournamentFull: string; division: string };

export type FeedTournament = { slug: string; label: string; name: string };

export type Feed = {
  /** Разрез, который в итоге показан. */
  cut: MatchCut;
  /** Разрез, который открылся бы сам (первый непустой) — по нему схлопывается канон. */
  defaultCut: MatchCut;
  counts: Record<MatchCut, number>;
  tournaments: FeedTournament[];
  picked: FeedTournament | null;
  /** Встречи этой страницы, в порядке ленты. Полные строки берёт `loadRows`. */
  ids: number[];
  meta: Map<number, SeriesMeta>;
  page: number;
  pages: number;
  total: number;
};

/** `null` — адреса нет: выдуманный слаг турнира или страница за последней. Это 404, а не пустой
 *  список: 200 с пустым экраном на любой мусор в query — готовая пустышка для выдачи. */
export const loadFeed = cache(async (m: string, t: string, p: string): Promise<Feed | null> => {
  const all = await listTournaments();
  const published = all.filter((x) => x.status !== "draft");
  const tournaments: FeedTournament[] = published.map((x) => ({
    slug: x.slug,
    label: x.short ?? x.name,
    name: x.name,
  }));

  const picked = t ? (tournaments.find((x) => x.slug === t) ?? null) : null;
  if (t && !picked) return null;

  const pickedId = picked ? published.find((x) => x.slug === picked.slug)!.id : null;
  const rows = await listSeriesBrief(pickedId ? { tournamentId: pickedId } : { published: true });

  const groups = splitCuts(rows);
  // Встречи без счёта и без назначенного времени — хвостом «Будущих». В афише главной их нет (там
  // четыре карточки ближайшего), а страница называется «все встречи»: такая встреча тоже встреча,
  // и сегодня её на сайте не видно нигде.
  const undated = rows.filter((s) => s.homeScore + s.awayScore === 0 && s.startAt == null);
  const cuts = {
    past: groups.past,
    today: groups.today,
    next: [...groups.next, ...undated],
  };

  const defaultCut = CUTS.find((c) => cuts[c].length > 0) ?? "past";
  // Явно выбранный разрез не подменяем даже пустой — показать другой список в ответ на нажатие
  // значит соврать про то, что нажали (правило главной и хронологии турниров).
  const cut = isMatchCut(m) ? m : defaultCut;

  const list = cuts[cut];
  const pages = Math.ceil(list.length / PAGE_SIZE);
  const page = /^\d+$/.test(p) ? Math.max(1, Number(p)) : 1;
  if (page > Math.max(pages, 1)) return null;

  const meta = new Map<number, SeriesMeta>();
  for (const x of published)
    for (const d of x.divisions)
      meta.set(d.id, {
        tournament: x.short ?? x.name,
        tournamentFull: x.name,
        division: d.short ?? d.slug.toUpperCase(),
      });

  return {
    cut,
    defaultCut,
    counts: { past: cuts.past.length, today: cuts.today.length, next: cuts.next.length },
    tournaments,
    picked,
    ids: list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((s) => s.id),
    meta,
    page,
    pages,
    total: list.length,
  };
});

/** Полные строки двадцати показанных встреч. Порядок держим свой: выборка по `id in (…)` отдаёт
 *  их в порядке базы, а в ленте он задан разрезом (у «Будущих» — по времени начала вверх). */
export async function loadRows(ids: number[]): Promise<SeriesRow[]> {
  if (ids.length === 0) return [];
  const rows = await listSeries({ ids });
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/**
 * Адрес состояния ленты: разрез, турнир и страница целиком в query.
 *
 * Страница в адрес попадает только со второй — и при смене разреза или турнира её не передают
 * вовсе: иначе «Сегодня» открылось бы на четвёртой странице и показало пустоту.
 */
export function feedHref({ cut, t, page }: { cut?: MatchCut; t?: string | null; page?: number }) {
  const q = new URLSearchParams();
  if (cut) q.set("m", cut);
  if (t) q.set("t", t);
  if (page && page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `/series?${s}` : "/series";
}
