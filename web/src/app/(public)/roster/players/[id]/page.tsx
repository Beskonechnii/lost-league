import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerProfile } from "@/lib/roster-data";
import { getPlayerHeroes } from "@/lib/player-stats";
import { getPlayerRecord } from "@/lib/player-record";
import { getPlayerLeague, mmss, type PlayerTournamentRow } from "@/lib/player-league";
import { ageOf, formatBirthday, playerGaps, playerLinks, teamAccent, telegramUrl, yearsLabel } from "@/lib/profiles";
import { heroImg } from "@/lib/assets";
import { rankLabel } from "@/lib/dota-rank";
import { roleLabel } from "@/lib/roles";
import { parseTags, tagLabel } from "@/lib/player-tags";
import { can } from "@/lib/account";
import { currentTournament, getDivisions } from "@/lib/tournaments";
import { buttonClasses } from "@/components/pouf/Button";
import { Eyebrow } from "@/app/_components/ui";
import { Breadcrumbs } from "@/app/_components/breadcrumbs";
import { PlayerAvatar, TeamLogo } from "../../_components/avatar";
import { PlayerMiniCard } from "../../_components/player-card";

export const dynamic = "force-dynamic";

/** Плашка факта: роль, MMR, возраст, город. Пустые значения не рисуем — дыр в строке быть не должно. */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-pill bg-surface px-3 py-1 text-xs font-bold text-ink-muted cushion-field">
      {children}
    </span>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-[14px] bg-surface px-3 py-1.5 text-xs font-bold text-ink-muted cushion-field transition-colors hover:text-[var(--purple)]"
    >
      {children}
    </a>
  );
}

/** Дата последней карты: «14 августа 2026». Без даты — прочерк, врать «недавно» не надо. */
const matchDate = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", year: "numeric" });

/**
 * Карточка турнира в статистике игрока: обложка лиги (пока заглушка в цвет команды — картинку
 * заведём позже), дата последней карты и два итога рядом — по встречам и по картам.
 * Раньше здесь была строка таблицы с иконкой героя; герой отсюда убран, для него есть свой блок.
 */
function TournamentCard({ row, accent }: { row: PlayerTournamentRow; accent: string }) {
  const body = (
    <div className="flex items-stretch gap-3 rounded-card bg-surface p-3 cushion-card transition group-hover:-translate-y-0.5">
      {/* Обложка лиги — заглушка: пропорции те же, что у будущей картинки, чтобы блок не прыгнул. */}
      <div
        className="grid h-[72px] w-[96px] shrink-0 place-items-center rounded-[14px] text-[11px] font-black uppercase tracking-[1px] text-ink-subtle"
        style={{ background: `linear-gradient(150deg, ${accent}55, ${accent}14 60%, var(--surface-2))` }}
      >
        LOST
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-ink">{row.tournament}</div>
          <div className="truncate text-xs font-bold text-muted">
            {row.division}
            {row.lastPlayedAt ? ` · последняя игра ${matchDate.format(row.lastPlayedAt)}` : ""}
          </div>
        </div>

        {/* Итоги: встречи — то, чем считается турнир по регламенту; карты — из чего они сложились. */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold tabular-nums">
          <span className="text-muted">
            встречи{" "}
            <span className="text-emerald-400">{row.series.wins}</span>
            <span className="text-ink-subtle">–</span>
            <span className="text-rose-400">{row.series.losses}</span>
          </span>
          <span className="text-muted">
            карты{" "}
            <span className="text-emerald-400">{row.wins}</span>
            <span className="text-ink-subtle">–</span>
            <span className="text-rose-400">{row.losses}</span>
          </span>
          <span className="text-[var(--purple)]">{row.winrate.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );

  return row.tournamentSlug ? (
    <Link href={`/tournaments/${row.tournamentSlug}`} className="group block">
      {body}
    </Link>
  ) : (
    <div className="group">{body}</div>
  );
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // В адресе ждём числовой id, но ссылка по слагу тоже встречается — карточку ищем по обоим
  // (rosterKey), иначе на слаге страница падала с 500 вместо «нет такого игрока».
  const player = await getPlayerProfile(id);
  if (!player) notFound();
  const pid = player.id;
  const [authed, heroes, record, league, divisions, tournament] = await Promise.all([
    can("roster.edit"), // кнопка «Править» — ровно то право, что откроет саму страницу правки
    getPlayerHeroes(pid),
    getPlayerRecord(pid),
    getPlayerLeague(pid),
    getDivisions(), // дивизионы текущего турнира: по ним отделяем «сейчас» от истории
    currentTournament(), // для крошек: витрина игроков живёт внутри турнира
  ]);

  // главное место — первое по порядку ролей: оно и задаёт цвет страницы, и рисуется в крошках
  const main = player.spots[0] ?? null;

  // «Сейчас в команде» — места в дивизионах текущего турнира плюс места вне турниров: страница
  // показывает всю историю мест, и без такого разделения непонятно, где игрок играет сегодня.
  // По одной строке на команду: в одной команде можно стоять и основой, и заменой разом.
  const currentIds = new Set(divisions.map((d) => d.id));
  const nowSpots = player.spots.filter((s) => s.divisionId === null || currentIds.has(s.divisionId));
  const nowTeams = [...new Map(nowSpots.map((s) => [s.team.id, s])).values()];
  const accent = main ? teamAccent(main.team) : "#a855f7";
  const links = playerLinks(player);
  const where = [player.city, player.country].filter(Boolean).join(", ");
  const gaps = playerGaps(player);
  const tags = parseTags(player.tags);
  // Достижения — свободный текст, одна строка = одна строчка списка; пустые строки отбрасываем.
  const achievements = (player.achievements ?? "").split("\n").map((s) => s.trim()).filter(Boolean);

  return (
    <div className="space-y-6 font-pouf">
      {/* Путь к карточке: турнир → витрина игроков → команда игрока. Ник не дублируем — он ниже, в H1. */}
      <Breadcrumbs
        items={[
          { href: "/tournaments", label: "Турниры" },
          ...(tournament
            ? [
                { href: `/tournaments/${tournament.slug}`, label: tournament.name },
                { href: `/tournaments/${tournament.slug}/roster/players`, label: "Игроки" },
              ]
            : []),
          ...(main ? [{ href: `/roster/teams/${main.team.id}`, label: main.team.name }] : []),
        ]}
      />

      {/* Шапка: цвет команды задаёт настроение страницы, лого уходит в подложку водяным знаком */}
      <section className="relative overflow-hidden rounded-card bg-surface cushion-card">
        {/* Баннер профиля — самый нижний слой шапки, поверх него затемняющий градиент для читаемости */}
        {player.banner && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.banner} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40" />
        )}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: player.banner
              ? `linear-gradient(115deg, ${accent}55, transparent 45%), linear-gradient(0deg, var(--color-surface-1), transparent 70%)`
              : `linear-gradient(115deg, ${accent}2e, transparent 55%)`,
          }}
        />
        {!player.banner && main?.team.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={main.team.logo}
            alt=""
            className="pointer-events-none absolute -right-8 -top-10 hidden h-56 w-56 object-contain opacity-[0.08] sm:block"
          />
        )}

        <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-start">
          <PlayerAvatar photo={player.photo} nickname={player.nickname} color={accent} size={200} />

          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h1 className="text-3xl font-black tracking-[-0.5px] text-ink">
                {player.orderNo != null && <span className="mr-2 align-middle text-xl font-black text-ink-subtle tabular-nums">#{player.orderNo}</span>}
                {player.nickname}
                {main?.isCaptain && <span className="ml-3 align-middle text-sm font-black text-[var(--purple)]">капитан</span>}
              </h1>
              {player.realName && <p className="font-bold text-ink-muted">{player.realName}</p>}
              {/* Плашки роли в лиге — кем человек является для лиги (игрок / кастер / организатор …) */}
              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span key={t} className="rounded-pill bg-purple px-3 py-1 text-xs font-black text-[var(--on-accent)]">
                      {tagLabel(t)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {main && (
                <Link
                  href={`/roster/teams/${main.team.id}`}
                  className="flex items-center gap-2 rounded-pill bg-surface px-3 py-1 text-xs cushion-field transition-transform hover:-translate-y-px"
                >
                  <TeamLogo team={main.team} size={18} />
                  <span className="font-black text-ink">{main.team.name}</span>
                  {roleLabel(main.role) && <span className="font-bold text-muted">{roleLabel(main.role)}</span>}
                </Link>
              )}
              {player.mmr && <Chip>{player.mmr.toLocaleString("ru")} MMR</Chip>}
              {/* Ранг — из OpenDota при импорте состава, в отличие от MMR (его ставит оператор). */}
              {rankLabel(player.rank) && <Chip>{rankLabel(player.rank)}</Chip>}
              {player.tp > 0 && (
                <Link href="/tp" className="rounded-pill bg-purple px-3 py-1 text-xs font-black text-[var(--on-accent)] cushion-control transition-transform hover:-translate-y-px">
                  {player.tp} TP
                </Link>
              )}
              {player.birthday && (
                <Chip>
                  {formatBirthday(player.birthday)} · {yearsLabel(ageOf(player.birthday))}
                </Chip>
              )}
              {where && <Chip>{where}</Chip>}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {player.telegram && <ExternalLink href={telegramUrl(player.telegram)}>@{player.telegram}</ExternalLink>}
              {links.dotabuff && <ExternalLink href={links.dotabuff}>Dotabuff</ExternalLink>}
              {links.stratz && <ExternalLink href={links.stratz}>Stratz</ExternalLink>}
              {links.steam && <ExternalLink href={links.steam}>Steam</ExternalLink>}
              {player.interviewUrl && <ExternalLink href={player.interviewUrl}>Интервью</ExternalLink>}
              {!links.dotabuff && !player.telegram && (
                <span className="text-xs font-bold text-muted">Ссылок нет — заполните account_id или телеграм</span>
              )}
            </div>
          </div>

          {/* Правка и служебный slug — только оператору: посетителю ни то, ни другое не нужно */}
          {authed && (
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <Link href={`/admin/roster/players/${player.id}/edit`} className={buttonClasses({ size: "sm" })}>
                Редактировать
              </Link>
              <span className="text-xs font-bold text-muted">slug: {player.slug}</span>
            </div>
          )}
        </div>

        {gaps.length > 0 && (
          <div className="relative border-t border-hairline px-6 py-2 text-xs font-bold text-amber-400/90">
            Не заполнено: {gaps.join(", ")}
          </div>
        )}
      </section>

      {/* Команды, за которые игрок заявлен сейчас: лого, название и роль — без состава.
          Состав каждой команды идёт ниже отдельными блоками, здесь нужен быстрый ответ
          «за кого он играет» и ссылка на команду. */}
      {nowTeams.length > 0 && (
        <section>
          <Eyebrow className="mb-3">Сейчас в командах</Eyebrow>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {nowTeams.map((spot) => (
              <Link
                key={spot.team.id}
                href={`/roster/teams/${spot.team.id}`}
                className="flex items-center gap-3 rounded-control bg-surface p-3 cushion-field transition hover:-translate-y-0.5"
              >
                <TeamLogo team={spot.team} size={40} className="rounded-[12px] bg-surface-2 p-1" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-ink">{spot.team.name}</div>
                  <div className="truncate text-xs font-bold text-muted">
                    {[roleLabel(spot.role) ?? "роль не задана", spot.division?.short ?? spot.division?.name]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Все места в составах: у действующего игрока оно одно, у замены и тренера может быть несколько */}
      {player.spots.map((spot) => (
        <section key={spot.id}>
          <div className="mb-3 flex flex-wrap items-baseline gap-2">
            <Eyebrow>{spot === player.spots[0] ? "Команда" : "Ещё в составе"}</Eyebrow>
            <Link href={`/roster/teams/${spot.team.id}`} className="text-sm font-medium text-ink-muted hover:text-[var(--purple)]">
              {spot.team.name}
            </Link>
            {/* Турнир и роль — отдельными плашками, а не строкой через точки: состав сезонный, и
                «в каком турнире и на какой роли» — первое, что с этой строки читают. */}
            <span className="flex flex-wrap items-center gap-1.5">
              <Chip>{roleLabel(spot.role) ?? "роль не задана"}</Chip>
              {spot.division ? (
                <Chip>
                  {spot.division.tournament.short ?? spot.division.tournament.name}
                  <span className="ml-1 text-ink-subtle">{spot.division.short ?? spot.division.name}</span>
                </Chip>
              ) : (
                <Chip>вне турнира</Chip>
              )}
              {spot.isCaptain && <Chip>капитан</Chip>}
            </span>
          </div>

          {spot.teammates.length === 0 ? (
            <p className="text-sm text-ink-subtle">В составе больше никого нет.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {spot.teammates.map((m) => (
                <PlayerMiniCard
                  key={m.id}
                  id={m.id}
                  nickname={m.nickname}
                  photo={m.photo}
                  accent={teamAccent(spot.team)}
                  role={roleLabel(m.role)}
                  mmr={m.mmr}
                  isCaptain={m.isCaptain}
                  size={44}
                />
              ))}
            </div>
          )}
        </section>
      ))}

      {/* Статистика лиги — из привязанных к сериям карт (MatchStat). Есть игры → карьерка и герои,
          нет → мягкая заглушка со ссылкой на Dotabuff. */}
      <section>
        <Eyebrow className="mb-3">Статистика лиги</Eyebrow>
        {record.games === 0 ? (
          <div className="rounded-card bg-surface cushion-field p-6 text-center text-sm text-ink-subtle">
            Появится, когда в архив лягут карты этого игрока: винрейт, герои, последние игры.
            {links.dotabuff && (
              <>
                {" "}
                Пока смотрите на{" "}
                <a href={links.dotabuff} target="_blank" rel="noreferrer" className="text-[var(--purple)] hover:underline">
                  Dotabuff
                </a>
                .
              </>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Карьерка: сыграно, W-L, винрейт — и средние за карту (KDA, GPM/XPM, длительность). */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "Карт", value: record.games, tone: "text-ink" },
                { label: "Победы — поражения", value: `${record.wins}–${record.losses}`, tone: "text-ink" },
                { label: "Винрейт", value: `${record.winrate.toFixed(0)}%`, tone: "text-[var(--purple)]" },
                { label: "Сред. KDA", value: `${league.summary.kills.toFixed(1)}/${league.summary.deaths.toFixed(1)}/${league.summary.assists.toFixed(1)}`, tone: "text-ink" },
                { label: "GPM / XPM", value: `${league.summary.gpm} / ${league.summary.xpm}`, tone: "text-ink" },
                { label: "Сред. время", value: mmss(league.summary.avgDurationSec) ?? "—", tone: "text-ink" },
              ].map((s) => (
                <div key={s.label} className="rounded-control bg-surface cushion-card p-4 text-center">
                  <div className={`text-xl font-black tabular-nums ${s.tone === "text-[var(--purple)]" ? "text-[var(--purple)]" : s.tone}`}>{s.value}</div>
                  <div className="mt-1 text-xs font-bold text-muted">{s.label}</div>
                </div>
              ))}
            </div>

            {/* По турнирам: карточка на дивизион турнира. Обложка лиги — пока заглушка в цвет
                (картинку добавим позже), рядом — когда сыграна последняя карта и чем кончились
                встречи и карты. Героя тут больше нет: для героев есть отдельный блок ниже. */}
            {league.tournaments.length > 0 && (
              <div>
                <div className="mb-2 text-[13px] font-extrabold uppercase tracking-[1.5px] text-muted">По турнирам</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {league.tournaments.map((t) => (
                    <TournamentCard key={t.key} row={t} accent={accent} />
                  ))}
                </div>
              </div>
            )}

            {/* Последние игры: короткая лента — 6 карт, каждая ссылкой на разбор матча.
                K/D/A вынесен вправо крупно: это то, ради чего в ленту и смотрят. */}
            {league.games.length > 0 && (
              <div>
                <div className="mb-2 text-[13px] font-extrabold uppercase tracking-[1.5px] text-muted">Последние игры</div>
                <div className="space-y-1.5">
                  {league.games.slice(0, 6).map((g) => (
                    <Link
                      key={g.matchId}
                      href={g.openDotaMatchId ? `/match/${g.openDotaMatchId}` : `/series/${g.seriesSlug}`}
                      className="flex items-center gap-3 rounded-control bg-surface cushion-field px-3 py-2.5 transition hover:-translate-y-0.5"
                    >
                      {/* Полоска исхода: зелёная — победа, красная — поражение */}
                      <span className={`h-10 w-1 shrink-0 rounded-full ${g.won ? "bg-emerald-400" : "bg-rose-400"}`} />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={heroImg(g.heroSlug)} alt={g.heroName} className="h-10 w-[62px] shrink-0 rounded object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className={`font-black ${g.won ? "text-emerald-400" : "text-rose-400"}`}>{g.won ? "W" : "L"}</span>
                          {g.opponent && (
                            <span className="truncate text-ink-muted">
                              {g.myTeam && <span className="text-ink">{g.myTeam.tag ?? g.myTeam.name}</span>} vs {g.opponent.tag ?? g.opponent.name}
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-ink-subtle">
                          {g.division} · {g.stageText}
                          {mmss(g.durationSec) ? ` · ${mmss(g.durationSec)}` : ""}
                        </div>
                      </div>
                      {/* K/D/A — крупно и в одну строку, GPM мельче под ним */}
                      <div className="shrink-0 text-right">
                        <div className="text-lg font-black leading-none tabular-nums">
                          <span className="text-emerald-400">{g.kills}</span>
                          <span className="text-ink-subtle">/</span>
                          <span className="text-rose-400">{g.deaths}</span>
                          <span className="text-ink-subtle">/</span>
                          <span className="text-sky-400">{g.assists}</span>
                        </div>
                        <div className="mt-1 text-[11px] font-bold tabular-nums text-muted">
                          {g.gpm} gpm · {g.xpm} xpm
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Герои: один блок вместо двух — «сигнатурные» и «самые играемые» показывали почти
                одно и то же. Топ-5 по числу карт, винрейт рядом. */}
            {heroes.heroes.length > 0 && (
              <div>
                <div className="mb-2 text-[13px] font-extrabold uppercase tracking-[1.5px] text-muted">Герои</div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {heroes.heroes.slice(0, 5).map((h) => (
                    <div key={h.slug} className="flex items-center gap-3 rounded-control bg-surface cushion-field p-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={heroImg(h.slug)} alt={h.name} className="h-10 w-[62px] shrink-0 rounded object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-black text-ink">{h.name}</div>
                        <div className="text-xs font-bold tabular-nums text-muted">
                          {h.games} карт · <span className="text-emerald-400">{h.wins}</span>–<span className="text-rose-400">{h.losses}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-black tabular-nums text-[var(--purple)]">{h.winrate.toFixed(0)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Достижения — свободный список из анкеты игрока. */}
      {achievements.length > 0 && (
        <section>
          <Eyebrow className="mb-3">Достижения</Eyebrow>
          <ul className="space-y-1.5">
            {achievements.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink-muted">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>
  );
}
