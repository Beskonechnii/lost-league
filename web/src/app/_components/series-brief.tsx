import Link from "next/link";
import type { SeriesRow } from "@/lib/series";
import { playoffLabel } from "@/lib/stages";
import { buttonClasses } from "@/components/pouf/Button";
import { Chip } from "@/components/pouf/blocks";
import { InfoWell, MapPills, ScoreWell, SeriesCard } from "@/components/pouf/series-card";

/* Встреча лиги карточкой Кита — один адаптер `SeriesRow` → `SeriesCard` на весь продукт.
 *
 * До Э7 этот перевод жил внутри страницы команды (`TeamSeriesCard`), и главной пришлось бы
 * завести второй такой же. Карточка встречи — самый повторяемый элемент продукта (§A Кита),
 * и два её сборщика разъехались бы на первой же правке: где-то «BO3», где-то дата, где-то
 * ссылка «Отчёт».
 *
 * Сама карточка (`pouf/series-card.tsx`) домен не знает — она про форму. Знание про стадии,
 * карты и адреса лиги живёт здесь, в `app/_components`, рядом с остальной обвязкой продукта.
 */

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const timeFmt = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

/** Подпись разреза встречи: «Группа A» либо «Верхняя сетка · Полуфинал». */
export function cutLabel(s: SeriesRow) {
  if (s.stage === "group") return s.group ? `Группа ${s.group}` : "Групповая стадия";
  return playoffLabel(s.bracket, s.round) || "Плей-офф";
}

export function SeriesBrief({
  s,
  teamId,
  cut,
}: {
  s: SeriesRow;
  /** Страница команды: карты в подвале считаются её глазами, ссылка на себя не ставится. */
  teamId?: number;
  /** Своя подпись разреза — витрине важнее дивизион, чем группа внутри него. */
  cut?: string;
}) {
  const played = s.homeScore + s.awayScore > 0;
  const winner = s.homeScore > s.awayScore ? "home" : s.awayScore > s.homeScore ? "away" : null;
  // Карты — глазами teamId, если он задан: карточка стоит на странице команды, и «выиграна»
  // должно означать «выиграна ею». На витрине точки отсчёта нет — считаем глазами хозяев.
  const eyes = teamId ?? s.home.id;
  const maps = s.games.map((g) => ({
    result: g.winnerTeamId == null ? null : g.winnerTeamId === eyes ? ("w" as const) : ("l" as const),
    // Номер карты ведёт прямо в её отчёт — но только если карта разобрана: без матча OpenDota
    // страницы /match/<id> не существует.
    href: g.openDotaMatchId ? `/match/${g.openDotaMatchId}` : undefined,
  }));
  const side = (t: SeriesRow["home"]) => ({
    name: t.name,
    tag: t.tag,
    logo: t.logo,
    // Ссылка только на соперника: ссылка на страницу, где ты уже стоишь, никуда не ведёт.
    href: t.id === teamId ? undefined : `/roster/teams/${t.id}`,
  });
  const when = s.playedAt ?? s.startAt;

  return (
    <SeriesCard
      badge={<Chip>{played ? "BO3" : "BO?"}</Chip>}
      cut={cut ?? cutLabel(s)}
      aside={when ? dateFmt.format(when) : played ? "дата не заведена" : "время не назначено"}
      home={side(s.home)}
      away={side(s.away)}
      center={
        played ? (
          <ScoreWell home={s.homeScore} away={s.awayScore} winner={winner} dim={s.guessed} />
        ) : (
          <InfoWell>{s.startAt ? timeFmt.format(s.startAt) : "—:—"}</InfoWell>
        )
      }
      foot={maps.length > 0 ? <MapPills maps={maps} /> : played ? <span>карты не привязаны</span> : undefined}
      action={
        <Link href={`/series/${s.slug}`} className={buttonClasses({ variant: "quiet", size: "sm" })}>
          {played ? "Отчёт" : "Подробнее"}
        </Link>
      }
    />
  );
}
