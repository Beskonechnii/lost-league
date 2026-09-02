import type { Metadata } from "next";
import Link from "next/link";
import {
  currentTournament,
  divisionTeams,
  getDivisions,
  registrationOpen,
  TOURNAMENT_STATUS_LABELS,
  type TournamentStatus,
} from "@/lib/tournaments";
import { listSeries, type SeriesRow } from "@/lib/series";
import { SITE_MAX_W, StatTile } from "@/components/pouf/blocks";
import { Eyebrow, Heading } from "@/components/pouf/text";
import { Hero, HeroChip, HeroFooter } from "@/components/pouf/hero";
import { EmptyState } from "@/components/pouf/feedback";
import { buttonClasses } from "@/components/pouf/Button";
import { Icon, type IconName } from "@/components/pouf/Icon";
import { SeriesBrief, cutLabel } from "@/app/_components/series-brief";

// Входная дверь продукта: что за лига, что в ней происходит прямо сейчас и куда идти дальше.
// До Э7 здесь стояла тёмная витрина с фиолетовым свечением и четырьмя одинаковыми карточками
// разделов — «список ссылок», а не лицо лиги. Теперь первым экраном идёт текущий сезон: статус,
// цифры, ближайшие встречи и последние результаты. Разделы остались, но ниже данных: посетитель
// приходит смотреть турнир, а не выбирать пункт меню (UI-GUIDELINES §9).
//
// Стиль — Кит (Light Clay): hero-подушка с мятной подсветкой, плитки чисел, карточки встреч.
// Цифры берём из базы, а не пишем руками: подписи на витрине не должны расходиться с данными.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description:
    "League of Spirit — киберспортивные турниры по Dota 2 в Минске. Таблица дивизиона, составы команд и разбор любого матча Dota 2.",
};

const SITE = "https://leagueofspirits.ru/lost_s1";
const date = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long" });

/** Постоянные разделы лиги — те же, что в сайдбаре: витрина не заводит своей навигации. */
const SECTIONS: { href: string; icon: IconName; title: string; text: string }[] = [
  {
    href: "/tournaments",
    icon: "trophy",
    title: "Турниры",
    text: "Сезоны и кубки лиги: регламент, сроки, дивизионы и заявленные составы.",
  },
  {
    href: "/roster",
    icon: "users",
    title: "Ростер",
    text: "Все команды лиги и их игроки: составы, роли, MMR и карточка каждого.",
  },
  {
    href: "/rules",
    icon: "book",
    title: "Правила лиги",
    text: "Регламент встреч, переносы, замены и то, за что снимают очки.",
  },
];

/**
 * Афиша витрины: что сыграно, что впереди и что показать карточками. Ближайшие сортируем по
 * назначенному времени снизу вверх — первой должна стоять та, что случится раньше, — а `listSeries`
 * отдаёт свежие сверху, отсюда и своя сортировка.
 *
 * Отдельной функцией, а не строками в теле страницы: `Date.now()` — импурный вызов, и в рендере
 * компонента его запрещает правило `react-hooks/purity`.
 */
function billboard(series: SeriesRow[], limit = 2) {
  const now = Date.now();
  const played = series.filter((s) => s.homeScore + s.awayScore > 0);
  const upcoming = series
    .filter((s) => s.homeScore + s.awayScore === 0 && s.startAt != null && s.startAt.getTime() >= now)
    .sort((a, b) => a.startAt!.getTime() - b.startAt!.getTime())
    .slice(0, limit);
  return { played, upcoming, recent: played.slice(0, limit) };
}

export default async function Home() {
  const current = await currentTournament();
  const divisions = current ? await getDivisions(current.id) : [];

  // Составы и встречи сезона — один заход на всё, что показывает витрина.
  const [rosters, series] = await Promise.all([
    Promise.all(divisions.map((d) => divisionTeams(d.id))),
    divisions.length > 0 ? listSeries({ divisionIds: divisions.map((d) => d.id) }) : Promise.resolve([]),
  ]);

  const teamsTotal = rosters.reduce((n, r) => n + r.length, 0);
  const short = new Map(divisions.map((d) => [d.id, d.short]));

  const { played, upcoming, recent } = billboard(series);

  const status = (current?.status as TournamentStatus) ?? null;
  const open = current ? registrationOpen(current) : false;
  const cut = (s: SeriesRow) => [short.get(s.divisionId ?? -1), cutLabel(s)].filter(Boolean).join(" · ");

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 space-y-8 px-4 py-8 font-pouf md:px-6`}>
      {/* Первый экран: лига и её текущий сезон одной подушкой. Заголовок держит имя лиги —
          это по-прежнему единственное, что должно прочитаться с первой секунды. */}
      <Hero>
        <div className="relative px-5 py-8 sm:px-[30px] sm:py-10">
          <Eyebrow>Киберспортивная лига · Минск</Eyebrow>
          <h1 className="mt-3 text-[40px] font-black uppercase leading-[1.02] tracking-[-1.5px] text-ink md:text-[64px]">
            League of Spirit
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] font-bold leading-[1.6] text-ink-muted md:text-[17px]">
            Любительские турниры по Dota 2: дивизионы, групповая стадия и плей-офф, живая таблица и
            разбор каждой сыгранной карты.
          </p>

          {current && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <HeroChip accent>{current.name}</HeroChip>
              {status && <HeroChip>{TOURNAMENT_STATUS_LABELS[status] ?? current.status}</HeroChip>}
              {current.startAt && (
                <HeroChip>
                  <Icon name="calendar" size="sm" />
                  {date.format(current.startAt)}
                  {current.endAt ? ` — ${date.format(current.endAt)}` : ""}
                </HeroChip>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {current && divisions.length > 0 && (
              <Link href={`/tournaments/${current.slug}/${divisions[0].slug}`} className={buttonClasses()}>
                Смотреть таблицу
              </Link>
            )}
            {current && open && (
              <Link href={`/tournaments/${current.slug}/apply`} className={buttonClasses({ variant: "quiet" })}>
                Подать заявку командой
              </Link>
            )}
            {!current && (
              <Link href="/tournaments" className={buttonClasses()}>
                Открыть турниры
              </Link>
            )}
          </div>
        </div>

        {current && (
          <HeroFooter>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Команд" value={teamsTotal} accent />
              <StatTile label="Дивизионов" value={divisions.length} />
              <StatTile label="Сыграно встреч" value={played.length} />
              <StatTile label="Впереди" value={series.length - played.length} />
            </div>
          </HeroFooter>
        )}
      </Hero>

      {/* Дивизионы ведут прямо в таблицу — то же решение, что на обзоре турнира: короткий путь
          к данным для того, кто пришёл впервые и ещё не знает про строку контекста. */}
      {current && divisions.length > 0 && (
        <section className="space-y-4">
          <Eyebrow>Дивизионы сезона</Eyebrow>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {divisions.map((d, i) => (
              <Link
                key={d.id}
                href={`/tournaments/${current.slug}/${d.slug}`}
                className="flex items-center gap-4 rounded-card bg-surface p-5 cushion-card transition hover:-translate-y-0.5"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] bg-accent-fill text-lg font-black text-[var(--on-accent)] cushion-control">
                  {d.short}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[17px] font-black tracking-[-0.3px] text-ink">{d.label}</span>
                  <span className="block text-xs font-extrabold text-muted">
                    {rosters[i].length} команд · таблица, группы и плей-офф
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Афиша и результаты — карточки Кита. Пусто у обоих блоков только до жеребьёвки; тогда
          вместо двух пустых заголовков показываем одно объяснение, почему встреч ещё нет. */}
      {current && (upcoming.length > 0 || recent.length > 0) && (
        // Две колонки только когда есть оба блока: одинокая колонка из двух режет карточку встречи
        // пополам, и названия команд в ней обрезаются многоточием.
        <div className={`grid gap-6 ${upcoming.length > 0 && recent.length > 0 ? "xl:grid-cols-2" : ""}`}>
          {upcoming.length > 0 && (
            <section className="space-y-3">
              <Eyebrow>Ближайшие встречи</Eyebrow>
              {upcoming.map((s) => (
                <SeriesBrief key={s.id} s={s} cut={cut(s)} />
              ))}
            </section>
          )}
          {recent.length > 0 && (
            <section className="space-y-3">
              <Eyebrow>Последние результаты</Eyebrow>
              {recent.map((s) => (
                <SeriesBrief key={s.id} s={s} cut={cut(s)} />
              ))}
            </section>
          )}
        </div>
      )}

      {current && series.length === 0 && (
        <EmptyState icon="calendar" title="Встреч ещё нет">
          Сетку составят после жеребьёвки — тогда здесь появится афиша ближайших игр и результаты
          сыгранных.
        </EmptyState>
      )}

      {!current && (
        <EmptyState icon="trophy" title="Сезон ещё не заведён">
          Как только организатор откроет турнир, здесь встанут его дивизионы, таблица и расписание.
        </EmptyState>
      )}

      <section className="space-y-4">
        <Eyebrow>Разделы</Eyebrow>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group flex flex-col gap-2 rounded-card bg-surface p-5 cushion-card transition hover:-translate-y-1"
            >
              <span className="grid h-11 w-11 place-items-center rounded-[16px] bg-surface-2 text-ink-muted cushion-field">
                <Icon name={s.icon} size="md" />
              </span>
              <Heading level={3}>{s.title}</Heading>
              <span className="text-sm font-bold leading-relaxed text-muted">{s.text}</span>
            </Link>
          ))}
        </div>
      </section>

      <p className="text-sm font-bold text-muted">
        Основной сайт лиги и анонсы сезона —{" "}
        <a href={SITE} target="_blank" rel="noreferrer" className="text-[var(--accent-ink)] hover:underline">
          leagueofspirits.ru
        </a>
        .
      </p>
    </main>
  );
}
