import Link from "next/link";
import { listPlayers } from "@/lib/roster-data";
import { getPlayerRecords } from "@/lib/player-record";
import { tpByTournament } from "@/lib/tp";
import { roleLabel } from "@/lib/roles";
import { playerAccountId, playerGaps, teamAccent } from "@/lib/profiles";
import { can } from "@/lib/account";
import { SectionHeader } from "@/app/_components/ui";
import { notFound } from "next/navigation";
import { PlayerMiniCard } from "@/app/(public)/roster/_components/player-card";
import { DivTabs, parseDiv } from "@/app/(public)/roster/_components/div-tabs";
import { RosterSwitch } from "@/app/(public)/roster/_components/roster-switch";
import { getDivisions, tournamentBySlug } from "@/lib/tournaments";

export const dynamic = "force-dynamic";

// Разрезы сортировки живут в query — как рейтинги и постгейм: ссылку с нужным порядком можно
// кинуть в чат. `tp` первым, потому что сезонный зачёт — витринный смысл списка.
const SORTS = [
  { key: "tp", label: "По TP" },
  { key: "games", label: "По играм" },
  { key: "wins", label: "По победам" },
  { key: "losses", label: "По поражениям" },
  { key: "name", label: "По нику" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];
const isSort = (v: unknown): v is SortKey => SORTS.some((s) => s.key === v);

// Витрина игроков — публичная. Форма создания и статистика пробелов в анкетах видны
// только вошедшему: это операторская диагностика полноты данных, а не факт о лиге.
export default async function PlayersPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; div?: string }>;
}) {
  const { slug } = await params;
  const tournament = await tournamentBySlug(slug);
  if (!tournament) notFound();

  const q = await searchParams;
  const sort: SortKey = isSort(q.sort) ? q.sort : "tp";
  const divisions = await getDivisions(tournament.id);
  const div = parseDiv(divisions, q.div);

  // Игроки — те, у кого есть место в дивизионах этого турнира (заявленные), а не весь пул лиги.
  // Цифры в карточках тоже турнирные: карьерка считается по сериям этих дивизионов, TP — по
  // реестру начислений этого турнира. Иначе витрина сезона показывала бы итоги за всю историю
  // лиги, и у новичка сезона рядом с ником стояли бы чужие 300 TP.
  const ids = divisions.filter((d) => !div || d.slug === div).map((d) => d.id);
  const [allPlayers, records, tpMap] = await Promise.all([
    listPlayers(ids),
    getPlayerRecords(null, { divisionIds: divisions.map((d) => d.id) }),
    tpByTournament(tournament.id),
  ]);
  const authed = await can("roster.edit"); // формы и диагностика — те же права, что у пишущих роутов

  // Дивизион игрока — по его местам в составе (`RosterSpot.divisionId`): выборка выше уже сужена
  // переданными `ids`, второй раз резать по строке-зеркалу `Team.group` не нужно — именно этот
  // фильтр опустошал вкладку дивизиона в новом турнире.
  const players = allPlayers;

  // Карьерка игрока (игры/победы/поражения) и TP — за ЭТОТ турнир. Нет статы → нули.
  const ranked = players.map((p) => {
    const rec = records.get(p.id) ?? { games: 0, wins: 0, losses: 0, winrate: 0 };
    return { ...p, rec, tp: tpMap.get(p.id) ?? 0 };
  });
  const byName = (a: (typeof ranked)[number], b: (typeof ranked)[number]) => a.nickname.localeCompare(b.nickname);
  ranked.sort((a, b) => {
    switch (sort) {
      case "tp": return b.tp - a.tp || byName(a, b);
      case "games": return b.rec.games - a.rec.games || byName(a, b);
      case "wins": return b.rec.wins - a.rec.wins || byName(a, b);
      case "losses": return b.rec.losses - a.rec.losses || byName(a, b);
      default: return byName(a, b);
    }
  });
  // Без account_id игрок не подтягивается из OpenDota; остальные дыры анкеты — из CRM, их добиваем
  // руками. Считаем по `playerAccountId`: id может лежать в ссылке на профиль, а не в своём поле.
  const noId = players.filter((p) => !playerAccountId(p)).length;
  const incomplete = players.filter((p) => playerGaps(p).length > 0).length;

  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader
        eyebrow={`${tournament.name} · ростер`}
        title="Игроки"
        aside={
          <>
            {players.length} игроков
            {authed && noId > 0 && <span className="ml-2 text-amber-400">{noId} без account_id</span>}
            {authed && incomplete > 0 && <span className="ml-2 text-ink-subtle">{incomplete} с неполной анкетой</span>}
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <RosterSwitch slug={slug} current="players" />
        <DivTabs divisions={divisions} current={div} base={`/tournaments/${slug}/roster/players`} keep={{ sort: sort === "tp" ? undefined : sort }} />
      </div>

      <div className="flex flex-wrap gap-2 font-pouf">
        {SORTS.map((s) => {
          const params = new URLSearchParams();
          if (s.key !== "tp") params.set("sort", s.key);
          if (div) params.set("div", div);
          const qs = params.toString();
          // Порядок меняем внутри ЭТОГО турнира: раньше ссылка вела на общий `/roster/players`,
          // а тот редиректит на текущий сезон — со страницы S3 сортировка уносила в S2.
          const base = `/tournaments/${slug}/roster/players`;
          return (
          <Link
            key={s.key}
            href={qs ? `${base}?${qs}` : base}
            className={`rounded-[14px] px-3.5 py-[7px] text-[13px] font-black transition-[box-shadow,transform,background] ${
              sort === s.key
                ? "bg-purple text-[var(--on-accent)] cushion-control"
                : "bg-surface text-ink-muted cushion-field hover:text-ink"
            }`}
          >
            {s.label}
          </Link>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ranked.map((p) => {
          // Пробелы анкеты подсвечиваем только оператору — это состояние наших данных,
          // а не факт об игроке. Посетитель видит ровную сетку карточек.
          const gaps = authed ? playerGaps(p) : [];
          const flagId = authed && !playerAccountId(p);
          return (
            <PlayerMiniCard
              key={p.id}
              id={p.id}
              nickname={p.nickname}
              photo={p.photo}
              accent={p.main ? teamAccent(p.main.team) : null}
              role={roleLabel(p.main?.role)}
              mmr={p.mmr}
              isCaptain={p.main?.isCaptain ?? false}
              size={56}
              flagged={flagId}
              subtitle={
                <div className="mt-1 space-y-0.5">
                  <div className="truncate text-xs text-ink-subtle">{p.main?.team.name ?? "без команды"}</div>
                  {/* Турнирная карьерка и TP — то, по чему сортируется список. Показываем только
                      непустое: у игрока без турнирных карт строки нет, ноль-плашки не нужны. */}
                  {(p.rec.games > 0 || p.tp > 0) && (
                    <div className="flex flex-wrap items-center gap-x-2 text-xs tabular-nums text-ink-muted">
                      {p.rec.games > 0 && (
                        <span>
                          {p.rec.games} игр · <span className="text-emerald-400">{p.rec.wins}</span>–
                          <span className="text-rose-400">{p.rec.losses}</span>
                        </span>
                      )}
                      {p.tp > 0 && <span className="font-semibold text-accent-bright">{p.tp} TP</span>}
                    </div>
                  )}
                  {/* стоит ещё где-то (обычно заменой) — показываем, чтобы не выглядело потерянным */}
                  {p.spots.length > 1 && (
                    <div className="truncate text-xs text-ink-subtle">
                      ещё в {p.spots.slice(1).map((s) => s.team.name).join(", ")}
                    </div>
                  )}
                  {/* чек-лист анкеты: что осталось добить из CRM (пусто для посетителя) */}
                  {gaps.length > 0 && (
                    <div className={`truncate text-xs ${playerAccountId(p) ? "text-ink-subtle" : "text-amber-400"}`}>
                      нет: {gaps.join(", ")}
                    </div>
                  )}
                </div>
              }
            />
          );
        })}
      </div>
    </div>
  );
}
