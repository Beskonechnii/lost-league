import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Icon } from "@/app/_components/postgame/blocks";
import { Eyebrow } from "@/components/pouf/text";
import { Chip } from "@/components/pouf/blocks";
import { Breadcrumbs } from "@/components/pouf/breadcrumbs";
import { READ_MAX_W } from "@/components/pouf/blocks";
import { MapPills, ScoreWell, SeriesCard } from "@/components/pouf/series-card";
import { divisionWithTournament } from "@/lib/tournaments";
import { getSeriesDetail, type GamePlayer, type SeriesDetail, type SeriesGameDetail } from "@/lib/series";
import { playoffLabel, stageLabel } from "@/lib/stages";

export const dynamic = "force-dynamic";

// Страница встречи: шапка со счётом серии и карты одна под другой, у каждой — оба состава.
// Форма взята с разбора серии на Dotabuff: за один экран видно и исход серии, и кто как сыграл
// на каждой карте. Детали карты (драфт, предметы, график) не дублируем — за ними ведёт /match/<id>.
//
// Э6: шапка встречи — та самая «Карточка встречи» из Кита (`pouf/series-card.tsx`), только крупная,
// а карты — подушки Кита. Свет и Тьма покрашены кожей постгейма (`--pg-radiant`/`--pg-dire`),
// чтобы страница серии и отчёт матча называли стороны одним цветом.

type Team = SeriesDetail["home"];

const clock = (sec: number | null) => (sec ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : "—");

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const s = await getSeriesDetail((await params).slug);
  if (!s) return { title: "Встреча не найдена" };
  return { title: `${s.home.name} — ${s.away.name}`, description: `${s.division}, ${stageLabel(s.stage)}` };
}

/** Подпись разреза: «Группа A» либо «Верхняя сетка · Полуфинал». */
function cutLabel(s: SeriesDetail) {
  if (s.stage === "group") return s.group ? `Группа ${s.group}` : "Групповая стадия";
  return playoffLabel(s.bracket, s.round) || "Плей-офф";
}

function PlayerRow({ p, won }: { p: GamePlayer; won: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1">
      {p.heroSlug ?
        <Icon kind="heroes" slug={p.heroSlug} name={p.heroSlug} h={22} />
      : <span className="h-[22px] w-[39px] shrink-0 rounded-sm bg-surface-2" />}
      <span className="w-5 shrink-0 text-center text-[11px] font-bold tabular-nums text-muted" title="уровень">
        {p.level || "—"}
      </span>
      <span className={`truncate text-sm font-bold ${won ? "text-ink" : "text-muted"}`}>{p.nickname}</span>
      <span className="ml-auto shrink-0 text-xs font-black tabular-nums" title="убийства / смерти / помощь">
        <span className="text-[var(--pg-radiant)]">{p.kills}</span>
        <span className="text-muted"> / </span>
        <span className="text-[var(--pg-dire)]">{p.deaths}</span>
        <span className="text-muted"> / </span>
        <span className="text-[var(--color-info-ink)]">{p.assists}</span>
      </span>
    </div>
  );
}

/** Состав одной команды на карте: сторона, первый пик, исход и пятёрка. */
function GameTeam({ team, game, firstPickTeamId }: { team: Team; game: SeriesGameDetail; firstPickTeamId: number | null }) {
  const won = game.winnerTeamId === team.id;
  const isRadiant = game.radiantTeamId === team.id;
  const players = game.byTeam[team.id] ?? [];
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex flex-wrap items-baseline gap-2 border-b border-hairline pb-1.5">
        <span className={`text-sm font-black ${won ? "text-[var(--accent-ink)]" : "text-muted"}`}>{team.name}</span>
        {game.radiantTeamId != null && (
          <span
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: isRadiant ? "var(--pg-radiant)" : "var(--pg-dire)" }}
          >
            {isRadiant ? "Свет" : "Тьма"}
          </span>
        )}
        {firstPickTeamId === team.id && <span className="text-[10px] font-bold text-muted">первый пик</span>}
        {won && <span className="ml-auto text-[10px] font-extrabold uppercase tracking-widest text-[var(--accent-ink)]">победа</span>}
      </div>
      {players.length ?
        players.map((p) => <PlayerRow key={p.playerId} p={p} won={won} />)
      : <p className="py-2 text-[11px] font-bold text-muted">Игроков этой команды нет в ростере — стата не легла.</p>}
      {/* В архив попадают только игроки лиги: у стендина нет анкеты, а значит и строки статы. */}
      {players.length > 0 && players.length < 5 && (
        <p className="pt-1 text-[10px] font-bold text-muted">
          ещё {5 - players.length} в ростере не заведён{5 - players.length > 1 ? "ы" : ""}
        </p>
      )}
    </div>
  );
}

function GameCard({ game, home, away }: { game: SeriesGameDetail; home: Team; away: Team }) {
  const homeRadiant = game.radiantTeamId === home.id;
  // Счёт по убийствам хранится по сторонам, а показываем по командам — разворачиваем.
  const homeKills = homeRadiant ? game.radiantScore : game.direScore;
  const awayKills = homeRadiant ? game.direScore : game.radiantScore;
  const firstPickTeamId =
    game.firstPickRadiant == null ? null
    : game.firstPickRadiant === homeRadiant ? home.id
    : away.id;

  return (
    <section className="overflow-hidden rounded-card bg-surface font-pouf cushion-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-hairline bg-surface-2 px-4 py-2.5">
        <span className="text-sm font-black text-ink">Карта {game.gameNumber ?? "?"}</span>
        {game.openDotaMatchId && (
          <Link href={`/match/${game.openDotaMatchId}`} className="text-xs font-black text-[var(--accent-ink)] hover:underline">
            отчёт {game.openDotaMatchId}
          </Link>
        )}
        <span className="text-xs font-bold tabular-nums text-muted">{clock(game.durationSec)}</span>
        {homeKills != null && awayKills != null && (
          <span className="text-sm font-black tabular-nums" title="убийства">
            <span className={game.winnerTeamId === home.id ? "text-[var(--accent-ink)]" : "text-muted"}>{homeKills}</span>
            <span className="mx-1 text-muted">—</span>
            <span className={game.winnerTeamId === away.id ? "text-[var(--accent-ink)]" : "text-muted"}>{awayKills}</span>
          </span>
        )}
        {game.startedAt && <span className="ml-auto text-[11px] font-bold text-muted">{dateFmt.format(game.startedAt)}</span>}
      </div>
      <div className="flex flex-col gap-4 p-4 md:flex-row md:gap-8">
        <GameTeam team={home} game={game} firstPickTeamId={firstPickTeamId} />
        <GameTeam team={away} game={game} firstPickTeamId={firstPickTeamId} />
      </div>
    </section>
  );
}

export default async function SeriesPage({ params }: { params: Promise<{ slug: string }> }) {
  // Ключ в адресе — слаг встречи, а не id: id автоинкрементный и после `db:import` другой,
  // так что ссылка ломалась бы на каждом переносе данных. Числовой id тоже принимаем — на случай
  // ссылок, отданных до появления слагов.
  const { slug } = await params;
  const s = await getSeriesDetail(slug);
  if (!s) notFound();

  // Раздел дивизиона живёт внутри турнира, поэтому ссылку строим по самому дивизиону встречи.
  const division = s.divisionId ? await divisionWithTournament(s.divisionId) : null;
  const divHref = division ? `/tournaments/${division.tournament.slug}/${division.slug}` : "/tournaments";
  const winner = s.homeScore > s.awayScore ? "home" : s.awayScore > s.homeScore ? "away" : null;
  const bo = s.homeScore + s.awayScore <= 1 ? "Bo1" : "Bo3";
  // Карты глазами хозяев — карточка стоит над списком карт, в котором хозяева всегда слева.
  const maps = s.games.map((g) => ({
    result: g.winnerTeamId == null ? null : g.winnerTeamId === s.home.id ? ("w" as const) : ("l" as const),
    // Ссылку с шапки не ставим: разбор каждой карты стоит прямо под ней, на этой же странице.
  }));

  return (
    <main className="flex-1 p-4 font-pouf md:p-8">
      {/* Колонка чтения (READ_MAX_W), а не витрины: это страница одной встречи — счёт и составы
          по карте. На всю ширину экрана строки состава растянулись бы некрасиво. */}
      <div className={`mx-auto ${READ_MAX_W} space-y-4`}>
        {/* У встречи нет ни строки контекста турнира, ни подвкладок — путь показывают только крошки */}
        <Breadcrumbs
          items={[
            { href: "/tournaments", label: "Турниры" },
            ...(division
              ? [
                  { href: `/tournaments/${division.tournament.slug}`, label: division.tournament.name },
                  { href: divHref, label: division.label ?? division.name },
                ]
              : []),
          ]}
        />

        {/* Шапка встречи — «Карточка встречи» Кита в крупном варианте. Дивизион здесь не повторяем:
            он стоит в крошках выше, а два одинаковых пути подряд читались как ошибка. */}
        <SeriesCard
          big
          badge={<Chip>{bo}</Chip>}
          cut={cutLabel(s)}
          aside={s.playedAt ? dateFmt.format(s.playedAt) : "дата не заведена"}
          home={{ ...s.home, href: `/roster/teams/${s.home.id}` }}
          away={{ ...s.away, href: `/roster/teams/${s.away.id}` }}
          center={<ScoreWell big home={s.homeScore} away={s.awayScore} winner={winner} dim={s.guessed} />}
          foot={
            <>
              {maps.length > 0 && <MapPills maps={maps} />}
              {s.guessed && <span className="text-[var(--color-warn-ink)]">счёт под вопросом</span>}
            </>
          }
          action={<span className="font-bold text-muted">{s.slug}</span>}
        />

        <Eyebrow className="pt-2">Карты</Eyebrow>

        {s.games.length === 0 && (
          <p className="rounded-card bg-surface p-6 text-sm font-bold text-muted cushion-field">
            К этой встрече ещё не привязано ни одной карты — известен только счёт серии.
          </p>
        )}

        {s.games.map((g) => (
          <GameCard key={g.matchId} game={g} home={s.home} away={s.away} />
        ))}
      </div>
    </main>
  );
}
