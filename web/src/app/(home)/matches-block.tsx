import type { SeriesRow } from "@/lib/series";
import { EmptyState } from "@/components/pouf/feedback";
import { PillLink } from "@/components/pouf/tabs";
import { SeriesCardStacked } from "@/components/pouf/series-card";
import { cutLabel } from "@/app/_components/series-brief";
import { Slab } from "./slab";

// Матчи на витрине — плита из макета `design/home/Main.dc.html`: три разреза вкладками и колонка
// карточек встреч. Заменяет прежние две колонки «Ближайшие встречи» / «Последние результаты»:
// они показывали одно и то же разными заголовками и делили ширину пополам, из-за чего на 1440
// одинокая карточка растягивалась в две команды по краям экрана.
//
// Разрез живёт в адресе (`/?m=today`), как и у турниров: ссылку на вкладку должно быть можно
// кинуть в чат (правило L4 стандарта), и блок остаётся серверным — без «use client» ради трёх
// кнопок и без второго механизма состояния на странице.

export const CUTS = ["past", "today", "next"] as const;
export type MatchCut = (typeof CUTS)[number];
export const isMatchCut = (v: string | undefined): v is MatchCut => (CUTS as readonly string[]).includes(v ?? "");

export const CUT_LABELS: Record<MatchCut, string> = { past: "Прошедшие", today: "Сегодня", next: "Будущие" };

// Пустое состояние у каждого разреза своё: «сегодня игр нет» и «сезон ещё не начался» — разные
// новости, и одна формулировка на три вкладки соврала бы в двух из трёх.
// Экспортируется (а не копируется в ленту `/series`): два текста на одно состояние разъедутся.
export const CUT_EMPTY: Record<MatchCut, { title: string; text: string }> = {
  past: { title: "Сыгранных встреч нет", text: "Результаты появятся здесь сразу после первого тура." },
  today: { title: "Сегодня игр нет", text: "Загляните в «Будущие» — там встречи, которым уже назначено время." },
  next: { title: "Назначенных встреч нет", text: "Время игр выставляет оператор; как только он это сделает, они встанут здесь." },
};

const dayTime = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const time = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Три разреза афиши. Функцией, а не строками в теле блока: `Date.now()` в рендере запрещает
 *  правило `react-hooks/purity` — та же причина, по которой считается `billboard` на странице.
 *  Ею же режет ленту `/series`: правило разреза в продукте одно. */
export function splitCuts<T extends { homeScore: number; awayScore: number; startAt: Date | null }>(series: T[]) {
  const now = Date.now();
  const today = startOfDay(new Date(now));
  const played = (s: T) => s.homeScore + s.awayScore > 0;
  return {
    // `listSeries` отдаёт свежие сверху — сыгранным этого и надо.
    past: series.filter(played),
    today: series.filter((s) => s.startAt != null && startOfDay(s.startAt) === today),
    next: series
      .filter((s) => !played(s) && s.startAt != null && s.startAt.getTime() >= now)
      .sort((a, b) => a.startAt!.getTime() - b.startAt!.getTime()),
  };
}

export function MatchesBlock({
  series,
  cut,
  divisionShort,
  limit = 4,
}: {
  series: SeriesRow[];
  cut?: MatchCut;
  /** Дивизион встречи подписью: витрине он важнее группы внутри него. */
  divisionShort: Map<number, string | null>;
  limit?: number;
}) {
  const groups = splitCuts(series);
  // Разрез по умолчанию — первый непустой, но ЯВНО выбранный не подменяем даже пустой:
  // показать другой список в ответ на нажатие — соврать про то, что нажали (как у турниров).
  const active = cut ?? CUTS.find((c) => groups[c].length > 0) ?? "past";
  const rows = groups[active].slice(0, limit);
  const empty = CUT_EMPTY[active];

  return (
    <Slab
      title="Матчи"
      aside={CUTS.map((c) => (
        <PillLink key={c} href={`/?m=${c}`} active={c === active} size="sm" scroll={false}>
          {CUT_LABELS[c]}
        </PillLink>
      ))}
      // «Все встречи» ведут в сквозную ленту лиги тем же разрезом, а не в текущий турнир: из
      // турнира виден только он сам, и любой разрез матчей открывал одну и ту же страницу.
      // Слово то же, что у раздела в баре: «матчи» — это карты (`/match/<id>`), а здесь встречи.
      more={{ href: `/series?m=${active}`, label: "все встречи" }}
    >
      {rows.length === 0 ? (
        <EmptyState icon="calendar" title={empty.title}>
          {empty.text}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((s) => {
            const when = s.playedAt ?? s.startAt;
            return (
              <SeriesCardStacked
                key={s.id}
                href={`/series/${s.slug}`}
                cut={[divisionShort.get(s.divisionId ?? -1), cutLabel(s)].filter(Boolean).join(" · ")}
                when={when ? (active === "today" ? time.format(when) : dayTime.format(when)) : undefined}
                home={{ name: s.home.name, tag: s.home.tag, logo: s.home.logo }}
                away={{ name: s.away.name, tag: s.away.tag, logo: s.away.logo }}
                homeScore={s.homeScore}
                awayScore={s.awayScore}
                played={s.homeScore + s.awayScore > 0}
              />
            );
          })}
        </div>
      )}
    </Slab>
  );
}
