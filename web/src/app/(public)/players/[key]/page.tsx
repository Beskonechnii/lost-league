import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPlayerProfile } from "@/lib/roster-data";
import { getPlayerHeroes } from "@/lib/player-stats";
import { getPlayerRecord } from "@/lib/player-record";
import { getPlayerLeague, mmss, type PlayerTournamentRow } from "@/lib/player-league";
import { ageOf, formatBirthday, playerGaps, playerLinks, playerPath, teamAccent, telegramUrl, yearsLabel } from "@/lib/profiles";
import { heroImg } from "@/lib/assets";
import { rankDelta, rankLabel } from "@/lib/dota-rank";
import { roleLabel } from "@/lib/roles";
import { parseTags, tagLabel } from "@/lib/player-tags";
import { can, currentAccount } from "@/lib/account";
import { chatAccountOfPlayer, chatIdentity } from "@/lib/chat";
import { shardsOfPlayer } from "@/lib/shards";
import { shardReasonLabel } from "@/lib/shard-grades";
import { currentTournament, getDivisions } from "@/lib/tournaments";
import { buttonClasses } from "@/components/pouf/Button";
import { Chip } from "@/components/pouf/blocks";
import { RankMedal, RankTrend } from "@/components/pouf/rank";
import { ShardAmount, ShardBar, ShardGradeBadge, ShardLadder } from "@/components/pouf/shards";
import { Card } from "@/components/pouf/surface";
import { Icon } from "@/components/pouf/Icon";
import { DataRow, Donut, FactBox, OverlapPill, OverlapRail, StatCoin } from "@/components/pouf/profile";
import { Breadcrumbs } from "@/components/pouf/breadcrumbs";
import { OnlineDot } from "@/app/_components/chat-live";
import { PlayerAvatar, TeamLogo } from "../../roster/_components/avatar";

export const dynamic = "force-dynamic";

/**
 * Страница собрана по канону «Профиль игрока» (макет из скилла `kit`): hero с баннером и
 * жетоном номера, ниже две колонки — слева карьера бубликом, игры, герои и ссылки, справа
 * рельс с командой, данными и достижениями. Атомы этой раскладки живут в `pouf/profile.tsx`.
 */

/** Подпись блока в карточке — «Карьера в лиге», «Данные». Мельче Eyebrow: это ярлык, а не шапка секции. */
function BlockLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-extrabold uppercase tracking-[0.6px] text-muted">{children}</div>;
}

/** Дата последней карты: «14 августа 2026». Без даты — прочерк, врать «недавно» не надо. */
const matchDate = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", year: "numeric" });

/**
 * Карточка турнира в статистике игрока: обложка лиги (пока заглушка в цвет команды — картинку
 * заведём позже), дата последней карты и два итога рядом — по встречам и по картам.
 */
function TournamentCard({ row, accent }: { row: PlayerTournamentRow; accent: string }) {
  const body = (
    <div className="flex items-stretch gap-3 rounded-control bg-surface p-3 cushion-row transition group-hover:-translate-y-0.5">
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
            встречи <span className="text-[var(--accent-ink)]">{row.series.wins}</span>
            <span className="text-ink-subtle">–</span>
            <span className="text-[var(--color-err-ink)]">{row.series.losses}</span>
          </span>
          <span className="text-muted">
            карты <span className="text-[var(--accent-ink)]">{row.wins}</span>
            <span className="text-ink-subtle">–</span>
            <span className="text-[var(--color-err-ink)]">{row.losses}</span>
          </span>
          <span className="text-[var(--accent-ink)]">{row.winrate.toFixed(0)}%</span>
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

export default async function PlayerPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  // Ключ адреса — слаг: он у игрока один, ставится навсегда и не меняется вместе с ником. Числовой
  // id тоже принимаем (старые ссылки, письма бота, закладки), но уводим на канонический адрес —
  // чтобы у страницы был ровно один URL, а не два одинаково рабочих.
  const player = await getPlayerProfile(key);
  if (!player) notFound();
  if (key !== player.slug) redirect(playerPath(player));
  const pid = player.id;
  const [authed, heroes, record, league, divisions, tournament, me, peerAccount] = await Promise.all([
    can("roster.edit"), // кнопка «Править» — ровно то право, что откроет саму страницу правки
    getPlayerHeroes(pid),
    getPlayerRecord(pid),
    getPlayerLeague(pid),
    getDivisions(), // дивизионы текущего турнира: по ним отделяем «сейчас» от истории
    currentTournament(), // для крошек: витрина игроков живёт внутри турнира
    currentAccount().then(chatIdentity), // кто смотрит — от этого зависит кнопка «Написать»
    chatAccountOfPlayer(pid), // есть ли кому писать: у игрока может не быть аккаунта на сайте
  ]);

  // Написать можно игроку лиги, у которого есть аккаунт, и не самому себе.
  const canWrite = !!me && !!peerAccount && me.playerId !== pid;
  // Свой профиль — он же кабинет: отсюда правят анкету и уходят в настройки аккаунта.
  const mine = me?.playerId === pid;
  // Осколки — после `mine`: на своей странице к ним идут подсказки «что сделать дальше», на чужой
  // остаётся только статус. Запрос отдельный, а не в общей пачке выше, именно из-за этой зависимости.
  const shards = await shardsOfPlayer(pid, mine);

  // главное место — первое по порядку ролей: оно и задаёт цвет страницы, и рисуется в крошках
  const main = player.spots[0] ?? null;

  // Места в дивизионах текущего турнира плюс места вне турниров — «где играет сегодня».
  const currentIds = new Set(divisions.map((d) => d.id));
  const accent = main ? teamAccent(main.team) : "#a855f7";
  const links = playerLinks(player);
  const gaps = playerGaps(player);
  const tags = parseTags(player.tags);
  // Достижения — свободный текст оператора, одна строка = одна строчка списка; пустые отбрасываем.
  const achievements = (player.achievements ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

  return (
    <div className="space-y-6 font-pouf">
      {/* Путь — только «Игроки лиги». Ни турнира, ни команды: страница описывает человека, а он
          переживает и сезон, и состав; путь через них врал бы уже на второй год, а на второй
          команде — сразу. Команда с этой страницы и так открывается — карточкой в правой колонке.
          Ник не дублируем: он ниже, в H1. */}
      <Breadcrumbs items={[{ href: "/roster/players", label: "Игроки лиги" }]} />

      {/* ── HERO: только личность. Баннер на всю плашку, аватарка стоит на нём ───────────── */}
      <section className="relative overflow-hidden rounded-card bg-surface cushion-card">
        {/* Баннер лежит на всей плашке, а не полосой сверху: полоса резала картинку жёстким краем
            посреди карточки, и загруженный кадр 1600×540 в ней всё равно не читался. Теперь свой
            баннер игрока (или мятная подложка Кита, если его нет) заполняет подушку целиком, а
            контент отделяет от него вуаль — градиент из прозрачного в бумагу карточки: сверху
            картинка видна во всю ширину, к низу она уходит в поверхность, и тёмный текст читается. */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ background: "linear-gradient(135deg,#dcefe6,#bfe1cf 55%,#a6d3bc)" }}
        >
          {player.banner && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={player.banner} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          {/* Знак команды водяным знаком в углу — то же место, что у монограммы в макете. */}
          {!player.banner && main?.team.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={main.team.logo} alt="" className="absolute -right-2 -top-7 h-[190px] w-[190px] object-contain opacity-[0.12]" />
          )}
          <div className="absolute inset-0 [background:radial-gradient(80%_140%_at_10%_0%,rgba(255,255,255,.6),transparent_55%)]" />
          <div className="absolute inset-0 [background:linear-gradient(180deg,transparent_0%,color-mix(in_srgb,var(--surface)_72%,transparent)_38%,color-mix(in_srgb,var(--surface)_94%,transparent)_66%,var(--surface)_100%)]" />
        </div>

        {/* Жетон номера в ростере — единственная цифра, которую хочется видеть в шапке. Номер есть у
            каждого: по умолчанию это id профиля, тот же, что в адресе страницы; `orderNo` остаётся
            ручным перекрытием. Лежит поверх аватарки (`z-20`): аватарка наезжает на этот угол, и без
            слоя жетон проступал из-под неё половиной пилюли. */}
        <div className="absolute left-8 top-7 z-20 inline-flex h-[52px] items-center gap-[7px] rounded-pill bg-surface px-4 text-[19px] font-black tabular-nums text-[var(--accent-ink)] cushion-row">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.5px] text-ink-subtle">№</span>
          {player.orderNo ?? player.id}
        </div>

        <div className="relative mt-[76px] flex flex-col gap-6 px-6 pb-7 sm:flex-row sm:items-end sm:px-8">
          <PlayerAvatar
            photo={player.photo}
            nickname={player.nickname}
            color={accent}
            size={150}
            className="rounded-[34px] [box-shadow:0_0_0_6px_var(--surface)]"
          />

          <div className="min-w-0 flex-1 sm:pb-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-[34px] font-black leading-none tracking-[-1px] text-ink sm:text-[40px]">{player.nickname}</h1>
              {/* Точка «в сети» у ника: сразу видно, ждать ли ответа сейчас или к вечеру. */}
              <OnlineDot playerId={pid} className="h-3 w-3" />
            </div>
            {player.realName && <p className="mt-2 text-base font-bold text-ink-muted">{player.realName}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {main?.isCaptain && (
                <Chip accent>
                  <Icon name="star" size="sm" />
                  Капитан
                </Chip>
              )}
              {main && roleLabel(main.role) && <Chip>{roleLabel(main.role)}</Chip>}
              {/* Плашки роли в лиге — кем человек является для лиги (игрок / кастер / организатор …) */}
              {tags.map((t) => (
                <Chip key={t}>{tagLabel(t)}</Chip>
              ))}
            </div>
          </div>

          {/* Действия над карточкой: свой профиль правят и настраивают, чужому пишут; правка
              ростера — отдельное, операторское действие. */}
          {(mine || canWrite || authed) && (
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end sm:pb-1">
              {mine && (
                <>
                  <Link href="/me/profile" className={buttonClasses({ size: "sm" })}>
                    <Icon name="draft" size="sm" />
                    Редактировать анкету
                  </Link>
                  <Link href="/me/settings" className={buttonClasses({ size: "sm", variant: "quiet" })}>
                    <Icon name="settings" size="sm" />
                    Настройки
                  </Link>
                </>
              )}
              {canWrite && (
                <Link href={`/chat/${pid}`} className={buttonClasses({ size: "sm" })}>
                  <Icon name="comment" size="sm" />
                  Написать
                </Link>
              )}
              {/* Операторская правка ростера — только на чужой карточке: свою анкету правят формой
                  выше, а два «редактировать» подряд не объясняются подписями. */}
              {authed && !mine && (
                <>
                  <Link href={`/admin/roster/players/${player.id}/edit`} className={buttonClasses({ size: "sm", variant: "quiet" })}>
                    Редактировать
                  </Link>
                  <span className="text-xs font-bold text-muted">slug: {player.slug}</span>
                </>
              )}
            </div>
          )}
        </div>

        {gaps.length > 0 && (
          <div className="relative border-t border-hairline px-6 py-2 text-xs font-bold text-[var(--color-warn-ink)]">
            Не заполнено: {gaps.join(", ")}
          </div>
        )}
      </section>

      {/* ── ДВЕ КОЛОНКИ: слева карьера и игры, справа команда и данные ───────────────────── */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
        {/* основная колонна */}
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <BlockLabel>Карьера в лиге</BlockLabel>
            {record.games === 0 ? (
              <p className="mt-3 text-sm font-bold text-ink-subtle">
                Появится, когда в архив лягут карты этого игрока: винрейт, герои, последние игры.
                {links.dotabuff && (
                  <>
                    {" "}
                    Пока смотрите на{" "}
                    <a href={links.dotabuff} target="_blank" rel="noreferrer" className="text-[var(--accent-ink)] hover:underline">
                      Dotabuff
                    </a>
                    .
                  </>
                )}
              </p>
            ) : (
              <>
                {/* Бублик — доля побед «на глаз», монеты рядом — средние за карту. */}
                <div className="mt-4 flex flex-wrap items-center gap-7">
                  <Donut pct={record.winrate} value={`${record.winrate.toFixed(0)}%`} caption="винрейт" />
                  <div className="grid min-w-[220px] flex-1 grid-cols-3 gap-3.5">
                    <StatCoin
                      icon="sword"
                      value={`${league.summary.kills.toFixed(1)}/${league.summary.deaths.toFixed(1)}/${league.summary.assists.toFixed(1)}`}
                      label="Ср. KDA"
                    />
                    <StatCoin icon="chart" value={`${league.summary.gpm} / ${league.summary.xpm}`} label="GPM / XPM" />
                    <StatCoin icon="clock" value={mmss(league.summary.avgDurationSec) ?? "—"} label="Ср. время" />
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-5 text-[13px] font-black tabular-nums">
                  <span className="font-extrabold text-muted">{record.games} карт</span>
                  <span>
                    <span className="text-[var(--accent-ink)]">{record.wins}</span>
                    <span className="text-ink-subtle"> – </span>
                    <span className="text-[var(--color-err-ink)]">{record.losses}</span>
                  </span>
                </div>
              </>
            )}
          </Card>

          {/* По турнирам. В макете это вторая вкладка сегмента «Лига / По турнирам», но
              переключателя нет: разрез по турнирам в лиге один, и прятать его за вкладку
              значит потерять единственное место, где он виден (BACKLOG §2). */}
          {league.tournaments.length > 0 && (
            <Card>
              <BlockLabel>По турнирам</BlockLabel>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2 [&>*]:min-w-0">
                {league.tournaments.map((t) => (
                  <TournamentCard key={t.key} row={t} accent={accent} />
                ))}
              </div>
            </Card>
          )}

          {league.games.length > 0 && (
            <Card>
              <BlockLabel>Последние игры</BlockLabel>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2 [&>*]:min-w-0">
                {league.games.slice(0, 6).map((g) => (
                  <Link
                    key={g.matchId}
                    href={g.openDotaMatchId ? `/match/${g.openDotaMatchId}` : `/series/${g.seriesSlug}`}
                    className="block transition hover:-translate-y-0.5"
                  >
                    <DataRow
                      thumb={
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={heroImg(g.heroSlug)} alt={g.heroName} className="h-9 w-9 shrink-0 rounded-[10px] object-cover" />
                      }
                      title={
                        <>
                          <span className={`mr-1.5 ${g.won ? "text-[var(--accent-ink)]" : "text-[var(--color-err-ink)]"}`}>
                            {g.won ? "W" : "L"}
                          </span>
                          {g.opponent ? (g.opponent.tag ?? g.opponent.name) : g.heroName}
                        </>
                      }
                      sub={`${g.division} · ${g.stageText}${mmss(g.durationSec) ? ` · ${mmss(g.durationSec)}` : ""}`}
                      aside={
                        <span className="shrink-0 text-right text-base font-black tabular-nums">
                          <span className="text-[var(--accent-ink)]">{g.kills}</span>
                          <span className="text-ink-subtle">/</span>
                          <span className="text-[var(--color-err-ink)]">{g.deaths}</span>
                          <span className="text-ink-subtle">/</span>
                          <span className="text-[var(--color-info-ink)]">{g.assists}</span>
                        </span>
                      }
                    />
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {heroes.heroes.length > 0 && (
            <Card>
              <BlockLabel>Герои</BlockLabel>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2 [&>*]:min-w-0">
                {heroes.heroes.slice(0, 6).map((h) => (
                  <DataRow
                    key={h.slug}
                    thumb={
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={heroImg(h.slug)} alt={h.name} className="h-9 w-9 shrink-0 rounded-[10px] object-cover" />
                    }
                    title={h.name}
                    sub={
                      <>
                        {h.games} карт · <span className="text-[var(--accent-ink)]">{h.wins}</span>–
                        <span className="text-[var(--color-err-ink)]">{h.losses}</span>
                      </>
                    }
                    aside={
                      <span className="shrink-0 text-sm font-black tabular-nums text-[var(--accent-ink)]">
                        {h.winrate.toFixed(0)}%
                      </span>
                    }
                  />
                ))}
              </div>
            </Card>
          )}

          {/* Ссылки — узкий блок, ширина по раскрытой пилюле: растянутый на колонку он
              выглядел бы пустым, у него всего четыре знака. */}
          <div className="lg:w-[300px]">
            <Card>
              <BlockLabel>Ссылки</BlockLabel>
              {links.dotabuff || player.telegram || player.interviewUrl ? (
                <OverlapRail>
                  {player.telegram && (
                    <OverlapPill external href={telegramUrl(player.telegram)} title="Телеграм" glyph={<LinkGlyph icon="send" />}>
                      @{player.telegram}
                    </OverlapPill>
                  )}
                  {links.dotabuff && (
                    <OverlapPill external href={links.dotabuff} title="Dotabuff" glyph={<LinkGlyph icon="chart" />}>
                      Dotabuff
                    </OverlapPill>
                  )}
                  {links.stratz && (
                    <OverlapPill external href={links.stratz} title="Stratz" glyph={<LinkGlyph icon="activity" />}>
                      Stratz
                    </OverlapPill>
                  )}
                  {links.steam && (
                    <OverlapPill external href={links.steam} title="Steam" glyph={<LinkGlyph icon="target" />}>
                      Steam
                    </OverlapPill>
                  )}
                  {player.interviewUrl && (
                    <OverlapPill external href={player.interviewUrl} title="Интервью" glyph={<LinkGlyph icon="comment" />}>
                      Интервью
                    </OverlapPill>
                  )}
                </OverlapRail>
              ) : (
                <p className="mt-3 text-xs font-bold text-muted">Ссылок нет — заполните account_id или телеграм.</p>
              )}
            </Card>
          </div>
        </div>

        {/* правый рельс */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* Команда: крупная карточка клуба, под ней состав рельсом внахлёст. По карточке на
              место в составе — у замены и тренера их бывает несколько. */}
          {player.spots.map((spot, i) => (
            <Card key={spot.id}>
              <div className="flex items-center justify-between gap-3">
                <BlockLabel>{i === 0 ? "Команда" : "Ещё в составе"}</BlockLabel>
                {/* Дивизион текущего турнира отличает «играет сейчас» от истории мест. */}
                <Chip accent={spot.divisionId === null || currentIds.has(spot.divisionId)}>
                  {spot.division ? (spot.division.short ?? spot.division.name) : "вне турнира"}
                </Chip>
              </div>

              <Link
                href={`/roster/teams/${spot.team.id}`}
                className="mt-4 flex items-center gap-3.5 rounded-control bg-surface p-4 cushion-card transition hover:-translate-y-0.5"
              >
                <TeamLogo team={spot.team} size={56} className="rounded-chip bg-surface-2 p-1.5 cushion-field" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xl font-black text-ink">{spot.team.name}</div>
                  <div className="truncate text-xs font-bold text-muted">
                    {[roleLabel(spot.role) ?? "роль не задана", spot.isCaptain ? "капитан" : null].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </Link>

              {spot.teammates.length === 0 ? (
                <p className="mt-3 text-sm font-bold text-ink-subtle">В составе больше никого нет.</p>
              ) : (
                <OverlapRail size="lg">
                  {spot.teammates.map((m) => (
                    <OverlapPill
                      key={m.id}
                      href={playerPath(m)}
                      title={m.nickname}
                      size="lg"
                      highlight={m.id === player.id}
                      glyph={
                        <PlayerAvatar photo={m.photo} nickname={m.nickname} color={teamAccent(spot.team)} size={60} shape="circle" />
                      }
                    >
                      <span className="block truncate text-[15px] font-black leading-tight text-ink">{m.nickname}</span>
                      <span className="mt-0.5 block truncate text-[11px] font-extrabold uppercase tracking-[0.4px] text-ink-subtle">
                        {roleLabel(m.role) ?? "—"}
                        {m.isCaptain ? " · кэп" : ""}
                      </span>
                    </OverlapPill>
                  ))}
                </OverlapRail>
              )}
            </Card>
          ))}

          {/* Данные — россыпь маленьких фактов. Пустые не рисуем: дыра в сетке хуже,
              чем короткий список. */}
          <Card>
            <BlockLabel>Данные</BlockLabel>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {player.mmr && <FactBox label="MMR" value={player.mmr.toLocaleString("ru")} />}
              {/* Ранг — из OpenDota (сверяется по лиге в `/admin/roster/ranks`), в отличие от MMR:
                  тот ставит оператор со слов игрока. Медалью, а не строкой: знак читается взглядом.
                  Дельта — второй строкой внутри той же плитки, а не отдельной: «было Легенда 2» в
                  соседней ячейке двухколоночной сетки не помещается и обрезается многоточием. */}
              {rankLabel(player.rank) && (
                <FactBox
                  label="Ранг"
                  small
                  value={
                    <span className="block">
                      <span className="flex items-center gap-2">
                        <RankMedal tier={player.rank} size="md" />
                        <span className="min-w-0 truncate">{rankLabel(player.rank)}</span>
                      </span>
                      {rankDelta(player.rank, player.rankPrev) && (
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <RankTrend tier={player.rank} prev={player.rankPrev} />
                          <span className="text-xs font-bold text-muted">было {rankLabel(player.rankPrev)}</span>
                        </span>
                      )}
                    </span>
                  }
                />
              )}
              {player.tp > 0 && (
                <Link href={tournament ? `/tournaments/${tournament.slug}/tp` : "/tp"} className="block transition hover:-translate-y-0.5">
                  <FactBox label="TP" value={player.tp} accent />
                </Link>
              )}
              {player.birthday && <FactBox label="Возраст" value={yearsLabel(ageOf(player.birthday))} small />}
              {player.birthday && <FactBox label="День рождения" value={formatBirthday(player.birthday)} small />}
              {player.city && <FactBox label="Город" value={player.city} small />}
              {player.country && <FactBox label="Страна" value={player.country} small />}
            </div>
            {!player.mmr && !rankLabel(player.rank) && !player.city && !player.country && !player.birthday && player.tp === 0 && (
              <p className="mt-3 text-xs font-bold text-muted">Анкета пока не заполнена.</p>
            )}
          </Card>

          {/* Осколки — статус за участие в жизни лиги, в отличие от TP рядом: тот даётся за игру
              и обнуляется с сезоном. Пустую карточку не рисуем: у карточки игрока из импорта
              аккаунта нет вовсе, и «0 осколков» сказало бы про человека неправду. */}
          {shards.earned > 0 && (
            <Card>
              <BlockLabel>Осколки</BlockLabel>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <ShardAmount amount={shards.earned} earned={shards.earned} size="md" />
                <ShardGradeBadge earned={shards.earned} />
              </div>
              {mine && (
                <div className="mt-4 space-y-4">
                  <ShardBar earned={shards.earned} />
                  <ShardLadder earned={shards.earned} />
                  <ul className="space-y-1 border-t border-hairline pt-3">
                    {shards.entries.map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-3 text-[13px] font-bold">
                        <span className="min-w-0 truncate text-ink">{e.note ?? shardReasonLabel(e.reason)}</span>
                        <ShardAmount amount={e.amount} earned={shards.earned} sign />
                      </li>
                    ))}
                  </ul>
                  {shards.todo.length > 0 && (
                    <p className="text-xs font-bold text-muted">
                      {shards.todo[0].hint} <span className="whitespace-nowrap text-ink">+{shards.todo[0].amount}</span>
                    </p>
                  )}
                </div>
              )}
            </Card>
          )}

          {achievements.length > 0 && (
            <Card>
              <BlockLabel>Достижения</BlockLabel>
              <div className="mt-4 space-y-3">
                {achievements.map((a, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm font-bold text-ink">
                    <span className="mt-px grid h-[22px] w-[22px] shrink-0 place-items-center rounded-pill bg-accent-fill text-[var(--on-accent)] cushion-blob">
                      <Icon name="trophy" size="sm" />
                    </span>
                    <span>{a}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/** Знак пилюли-ссылки: иконка в круге размером с саму пилюлю. */
function LinkGlyph({ icon }: { icon: Parameters<typeof Icon>[0]["name"] }) {
  return (
    <span className="grid h-[42px] w-[42px] shrink-0 place-items-center text-[var(--accent-ink)]">
      <Icon name={icon} size="md" />
    </span>
  );
}
