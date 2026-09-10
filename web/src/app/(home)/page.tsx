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
import { Eyebrow } from "@/components/pouf/text";
import { Hero, HeroChip, HeroFooter } from "@/components/pouf/hero";
import { EmptyState } from "@/components/pouf/feedback";
import { buttonClasses } from "@/components/pouf/Button";
import { Icon } from "@/components/pouf/Icon";
import { SeriesBrief, cutLabel } from "@/app/_components/series-brief";
import { currentAccountNav } from "@/app/_components/account-nav";
import { MiniProfile } from "./mini-profile";
import { TournamentsBlock, isTournamentCut } from "./tournaments-block";
import { HomeBanner } from "./banner";
import { PointsBlock } from "./points";
import { ShardsBlock } from "./shards";

// Входная дверь продукта — витрина, а не список разделов (Э21 RELEASE-PLAN §E).
//
// Порядок блоков отвечает на вопросы в том порядке, в каком они возникают: что это за лига (hero),
// кто здесь я (мини-профиль), что у лиги происходит (турниры), что мне сейчас сделать (баннер),
// во что смотреть (матчи) и кто впереди (очки). Плитки «Разделы» с главной сняты: разделы стоят
// в верхней строке хрома, и повторять их карточками — это и был «список ссылок вместо лица лиги».
//
// Сайдбара на этой странице нет — вместо него строка с аватар-меню (`_components/home-shell.tsx`).
// Почему так решено — в комментарии там же и в UI-GUIDELINES §2.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description:
    "SPIRIT/CTRL — киберспортивные турниры по Dota 2 в Минске. Таблица дивизиона, составы команд и разбор любого матча Dota 2.",
};

const SITE = "https://leagueofspirits.ru/lost_s1";
const date = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long" });

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

export default async function Home({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const nav = await currentAccountNav();
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
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 space-y-8 px-4 pb-8 pt-4 font-pouf md:px-6`}>
      {/* Первый экран: лига и её текущий сезон одной подушкой. Заголовок держит имя лиги —
          это по-прежнему единственное, что должно прочитаться с первой секунды. */}
      <Hero>
        <div className="relative px-5 py-8 sm:px-[30px] sm:py-10">
          <Eyebrow>Киберспортивная лига · Минск</Eyebrow>
          <h1 className="mt-3 text-[40px] font-black uppercase leading-[1.02] tracking-[-1.5px] text-ink md:text-[64px]">
            SPIRIT/CTRL
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

      {/* Кто здесь я: гостю — дверь, новичку — состояние заявки, игроку — его карточка. */}
      <MiniProfile account={nav.raw} nav={nav} />

      {/* Что у лиги происходит: три разреза турниров, выбор — в адресе (`/?t=next`). */}
      <TournamentsBlock cut={isTournamentCut(t) ? t : undefined} />

      {/* Что сделать прямо сейчас — одно предложение, выбранное по данным. */}
      <HomeBanner guest={!nav.raw} />

      {/* Афиша и результаты — карточки Кита. Пусто у обоих блоков только до жеребьёвки; тогда
          вместо двух пустых заголовков показываем одно объяснение, почему встреч ещё нет. */}
      {current && (upcoming.length > 0 || recent.length > 0) && (
        // Карточки всегда стоят в две колонки, а не одной лентой во всю ширину витрины: на 1440px
        // одинокая карточка встречи растягивается на 1200px и превращается в две команды по краям
        // экрана с пустотой между ними. Когда оба блока есть — колонку делят они, когда блок один —
        // его собственные карточки (`lg:grid-cols-2`).
        <div className={`grid gap-6 ${upcoming.length > 0 && recent.length > 0 ? "xl:grid-cols-2" : ""}`}>
          {upcoming.length > 0 && (
            <section className="space-y-3">
              <Eyebrow>Ближайшие встречи</Eyebrow>
              <div className={`grid gap-3 ${recent.length > 0 ? "" : "lg:grid-cols-2"}`}>
                {upcoming.map((s) => (
                  <SeriesBrief key={s.id} s={s} cut={cut(s)} />
                ))}
              </div>
            </section>
          )}
          {recent.length > 0 && (
            <section className="space-y-3">
              <Eyebrow>Последние результаты</Eyebrow>
              <div className={`grid gap-3 ${upcoming.length > 0 ? "" : "lg:grid-cols-2"}`}>
                {recent.map((s) => (
                  <SeriesBrief key={s.id} s={s} cut={cut(s)} />
                ))}
              </div>
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

      {/* Две валюты лиги рядом: слева зачёт TP (за игру, сезонный), справа свои осколки (за
          участие, за всё время). Гостю осколков нет — колонка одна, и разрез не нужен. */}
      <div className={`grid gap-6 ${nav.raw ? "xl:grid-cols-2" : ""}`}>
        <PointsBlock tournament={current} playerId={nav.raw?.player?.id ?? null} />
        {nav.raw && <ShardsBlock accountId={nav.raw.id} />}
      </div>

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
