import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamProfile, teamRosterHistory, rosterKey, type RosterMember, type TeamSeasonRoster } from "@/lib/roster-data";
import { prisma } from "@/lib/prisma";
import { getStandings } from "@/lib/standings";
import { listSeries } from "@/lib/series";
import { teamDivision } from "@/lib/tournaments";
import { playerPath, teamAccent, teamTag } from "@/lib/profiles";
import { buttonClasses } from "@/components/pouf/Button";
import { roleLabel } from "@/lib/roles";
import { QUALIFICATION, qualificationOf } from "@/lib/qualification";
import { can } from "@/lib/account";
import { Eyebrow } from "@/components/pouf/text";
import { StatTile } from "@/components/pouf/blocks";
import { Hero, HeroChip, HeroFooter, HeroLogo, RosterLine } from "@/components/pouf/hero";
import { SeriesBrief } from "@/app/_components/series-brief";
import { Breadcrumbs } from "@/components/pouf/breadcrumbs";
import { PlayerAvatar } from "../../_components/avatar";

export const dynamic = "force-dynamic";

/**
 * Карточка команды собрана по артборду Кита «Hero-шапка команды» (Э6 RELEASE-PLAN):
 * подушка с мятным светом, крупный знак, чипы участия, полоса плиток снизу, состав
 * строками. Ниже — встречи команды карточками из артборда «Карточка встречи».
 *
 * До Э6 шапка стояла на `TeamCover` — тёмной обложке с чёрным градиентом, остатке
 * тёмной темы: на бумаге Кита она читалась как дыра. Обложка снята, баннер команды
 * (если он есть) стал верхним слоем той же светлой подушки.
 */

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // id или слаг — см. rosterKey: на слаге страница раньше падала с 500. Дивизион ищем по её
  // собственному участию раньше состава: getTeamProfile фильтрует ростер именно по нему, иначе
  // команда, только что принятая в новый турнир, оставалась бы без состава на своей же странице.
  const teamRow = await prisma.team.findUnique({ where: rosterKey(id), select: { id: true } });
  if (!teamRow) notFound();
  const division = await teamDivision(teamRow.id);

  // Таблицу берём по дивизиону команды в текущем турнире — тому же, что показывает его раздел.
  // Команда вне турнира (например, из прошлого сезона) таблицы не получает — это не ошибка.
  const [team, standings, authed, history, series] = await Promise.all([
    getTeamProfile(id, division?.id),
    division ? getStandings(division.id) : Promise.resolve([]),
    can("roster.edit"),
    // Состав сезонный, поэтому у команды, прожившей не один турнир, есть прошлые составы.
    teamRosterHistory(teamRow.id, division?.id),
    // Встречи текущего турнира. Вне турнира дивизиона нет — берём все встречи команды,
    // иначе у архивной команды блок встреч пропал бы вместе с её историей.
    listSeries(division ? { teamId: teamRow.id, divisionId: division.id } : { teamId: teamRow.id }),
  ]);
  if (!team) notFound();

  const accent = teamAccent(team);
  const tag = teamTag(team);
  const core = team.players.filter((p) => p.position !== null);
  const staff = team.players.filter((p) => p.position === null);
  const captain = team.players.find((p) => p.isCaptain) ?? null;

  // Место берём из общей таблицы, а не считаем заново: один источник с разделом «LOST D1».
  const group = standings.find((g) => g.rows.some((r) => r.teamId === team.id));
  const row = group?.rows.find((r) => r.teamId === team.id) ?? null;
  const zone = row?.place && division ? qualificationOf(row.place, group!.rows.length, division.relegation) : null;

  // Карты за турнир считаем по встречам, а не по таблице: у StandingRow карт нет, а серии —
  // тот же источник, из которого таблица считает очки, так что цифры не разъедутся.
  const mapScore = series.reduce(
    (acc, s) => {
      const own = s.home.id === team.id ? s.homeScore : s.awayScore;
      const opp = s.home.id === team.id ? s.awayScore : s.homeScore;
      return { won: acc.won + own, lost: acc.lost + opp };
    },
    { won: 0, lost: 0 },
  );
  const mapDiff = mapScore.won - mapScore.lost;

  return (
    <div className="space-y-6 font-pouf">
      {/* Карточка живёт вне турнира и своей строки контекста не имеет — путь показывают крошки.
          Турнир берём тот, в котором команда играет сейчас; вне турнира ведём в общий список. */}
      <Breadcrumbs
        items={
          division
            ? [
                { href: "/tournaments", label: "Турниры" },
                { href: `/tournaments/${division.tournament.slug}`, label: division.tournament.name },
                { href: `/tournaments/${division.tournament.slug}/roster/teams`, label: "Команды" },
              ]
            : [{ href: "/tournaments", label: "Турниры" }]
        }
      />

      <Hero>
        {/* Баннер команды, если он заведён, ложится на всю подушку шапки и растушёвывается
            в её бумагу — приём с шапки игрока. Нет баннера — остаётся мятный свет Кита. */}
        {team.banner && (
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={team.banner} alt="" className="absolute inset-0 h-full w-full object-cover" />
            {/* Вуаль вместо жёсткой границы полосы: картинка видна во всю плашку и к низу уходит
                в бумагу шапки, так что тёмный текст поверх неё читается. Приём с шапки игрока, но
                вуаль плотнее с самого верха: у команды название стоит у верхнего края плашки, а не
                на 76px ниже, — прозрачная макушка положила бы его прямо на картинку. */}
            <div className="absolute inset-0 [background:linear-gradient(180deg,color-mix(in_srgb,var(--surface)_46%,transparent)_0%,color-mix(in_srgb,var(--surface)_84%,transparent)_42%,var(--surface)_100%)]" />
          </div>
        )}

        <div className="relative flex flex-col items-center gap-5 p-5 text-center sm:flex-row sm:items-start sm:gap-7 sm:p-[30px] sm:text-left">
          <HeroLogo logo={team.logo} fallback={tag} name={team.name} />

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black leading-tight tracking-[-0.6px] text-ink sm:text-[34px] sm:tracking-[-0.8px]">
              {team.name}
              <span className="ml-3 align-middle text-[15px] font-extrabold uppercase text-muted sm:text-xl">{tag}</span>
            </h1>
            <p className="mt-1 text-sm font-bold text-muted">
              {[
                captain ? `капитан: ${captain.nickname}` : null,
                `${team.playersCount} игрок(ов)`,
                team.mmrAverage !== null ? `ср. MMR основы ${team.mmrAverage.toLocaleString("ru")}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>

            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              {division && <HeroChip accent>{division.label ?? division.name}</HeroChip>}
              {group && <HeroChip>Группа {group.group}</HeroChip>}
              {row?.place && <HeroChip>{row.place}-е место</HeroChip>}
              {row && (
                <HeroChip title="выиграно — проиграно встреч">
                  {row.wins}–{row.losses}
                </HeroChip>
              )}
              {zone && <HeroChip title="зона по итогам группы">{QUALIFICATION[zone].label}</HeroChip>}
            </div>

            {/* Переходы в разделы дивизиона — те же цифры, но в контексте всего турнира */}
            {division && (
              <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs font-black sm:justify-start">
                <Link href={`/tournaments/${division.tournament.slug}/${division.slug}`} className="text-[var(--accent-ink)] hover:underline">
                  Таблица дивизиона →
                </Link>
                <Link
                  href={`/tournaments/${division.tournament.slug}/${division.slug}/playoff`}
                  className="text-[var(--accent-ink)] hover:underline"
                >
                  Плей-офф →
                </Link>
              </div>
            )}
          </div>

          {/* Оператору — правка и служебный слаг; посетителю ни то, ни другое не нужно */}
          {authed && (
            <div className="flex shrink-0 flex-col items-center gap-2 sm:items-end">
              <Link href={`/admin/roster/teams/${team.id}/edit`} className={buttonClasses({ size: "sm" })}>
                Редактировать
              </Link>
              <span className="text-xs font-bold text-muted">slug: {team.slug}</span>
            </div>
          )}
        </div>

        {/* Плитки участия — низ шапки в Ките. Вне турнира их нет: считать нечего, и пустая
            полоса с прочерками врала бы, будто команда сыграла ноль встреч в текущем сезоне. */}
        {row && (
          <HeroFooter>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {row.place && (
                <StatTile accent label="Место" value={`${row.place}`} hint={group ? `из ${group.rows.length}` : undefined} />
              )}
              <StatTile label="Очки" value={row.points.toLocaleString("ru")} hint={`${row.played} серий`} />
              <StatTile label="В — П" value={`${row.wins} — ${row.losses}`} />
              <StatTile label="Карты" value={`${mapScore.won}–${mapScore.lost}`} hint={`разница ${mapDiff > 0 ? "+" : mapDiff < 0 ? "−" : ""}${Math.abs(mapDiff)}`} />
            </div>
          </HeroFooter>
        )}
      </Hero>

      {/* Состав сезонный (RosterSpot принадлежит дивизиону), поэтому подписываем, чей это состав */}
      <RosterSection
        title={division ? `Основа · ${division.tournament.short ?? division.tournament.name}` : "Основа"}
        players={core}
        accent={accent}
        empty="Основа не заведена."
      />
      {staff.length > 0 && <RosterSection title="Штаб" players={staff} accent={accent} empty="" />}

      {/* Встречи команды — карточки из артборда «Карточка встречи». Свежие сверху (порядок listSeries). */}
      <section className="space-y-3">
        <Eyebrow>Встречи{division ? ` · ${division.tournament.short ?? division.tournament.name}` : ""}</Eyebrow>
        {series.length === 0 ? (
          <p className="rounded-card bg-surface p-6 text-sm font-bold text-muted cushion-field">
            Встречи появятся, когда команду разведут по сетке: до жеребьёвки соперников ещё нет.
          </p>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {series.map((s) => (
              <SeriesBrief key={s.id} s={s} teamId={team.id} />
            ))}
          </div>
        )}
      </section>

      {/* Составы других турниров: по одному блоку на турнир, свежие сверху. Свёрнуты — на карточке
          в первую очередь смотрят состав текущего турнира, остальные нужны реже. Заголовок не
          «прошлые»: сюда попадает и уже заявленный состав следующего сезона. */}
      {history.length > 0 && (
        <section className="space-y-3">
          <Eyebrow>Составы в других турнирах</Eyebrow>
          {history.map((season) => (
            <SeasonRoster key={season.divisionId} season={season} />
          ))}
        </section>
      )}
    </div>
  );
}

/** Состав команды в прошлом турнире: шапка с турниром, дивизионом и итогом, внутри — игроки с ролями. */
function SeasonRoster({ season }: { season: TeamSeasonRoster }) {
  const { tournament, division, result, players } = season;
  return (
    <details className="rounded-card bg-surface px-4 py-3 cushion-field">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-black text-ink">
        <Link href={`/tournaments/${tournament.slug}`} className="hover:text-[var(--accent-ink)]">
          {tournament.short ?? tournament.name}
        </Link>
        <span className="text-xs font-bold text-muted">{division.label ?? division.name}</span>
        {result?.place ? (
          <span className="text-xs font-bold text-muted">
            группа {result.group} · {result.place} место
          </span>
        ) : null}
        <span className="text-xs font-bold text-muted">{players.length} игрок(ов)</span>
      </summary>

      <ul className="mt-3 space-y-1">
        {players.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2 text-xs font-bold text-muted">
            <Link href={playerPath(p)} className="font-black text-ink hover:text-[var(--accent-ink)]">
              {p.nickname}
            </Link>
            {p.isCaptain && <span className="font-black text-[var(--accent-ink)]">C</span>}
            <span>{roleLabel(p.role) ?? "роль не задана"}</span>
            {p.mmr && <span>{p.mmr} MMR</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Состав строками Кита (`.rostline`), а не витриной мини-карточек: на странице команды
 * состав читают списком сверху вниз, и сетка карточек здесь спорила с плитками шапки.
 */
function RosterSection({
  title,
  players,
  accent,
  empty,
}: {
  title: string;
  players: RosterMember[];
  accent: string;
  empty: string;
}) {
  return (
    <section>
      <Eyebrow className="mb-3">{title}</Eyebrow>
      {players.length === 0 ? (
        <p className="text-sm font-bold text-muted">{empty}</p>
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2">
          {players.map((p) => (
            <RosterLine
              key={p.id}
              href={playerPath(p)}
              glyph={<PlayerAvatar photo={p.photo} nickname={p.nickname} color={accent} size={34} className="rounded-[12px]" />}
              name={
                <>
                  <span className="truncate">{p.nickname}</span>
                  {p.isCaptain && <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.8px] text-[var(--accent-ink)]">капитан</span>}
                </>
              }
              sub={[roleLabel(p.role) ?? "роль не задана", p.mmr ? `${p.mmr.toLocaleString("ru")} MMR` : null]
                .filter(Boolean)
                .join(" · ")}
              aside={p.position ? `№${p.position}` : "Штаб"}
            />
          ))}
        </div>
      )}
    </section>
  );
}
