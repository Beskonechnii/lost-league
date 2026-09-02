"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AdvantageChart, BuildingMap, EventBadges } from "@/app/_components/postgame/blocks";
import { PostgameExport } from "@/app/_components/postgame/export-canvas";
import { VisionMap } from "@/app/_components/postgame/vision-map";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { buttonClasses } from "@/components/pouf/Button";
import { initials, type MatchReport, type PlayerReport } from "@/app/_components/postgame/types";
import { teamByName, useDetectedTeams, useRosterTeams, type MatchSource } from "./report-detect";
import { BansStrip, HeroStrip, ScoreHeader } from "./report-summary";
import { CardScoreboard } from "./report-scoreboard";
import { Draft, PlayerDetails } from "./report-extra";

// Отчёт по матчу. Всё состояние — в адресе (`/match/<id>?src=&tab=&radiant=&dire=`):
// ссылкой на разбор можно поделиться, и она откроется ровно тем же, что видел отправитель.
// Данные тянутся с клиента через /api/<src>/match/<id> — те же роуты, что и раньше.
//
// Э6: файл был 913 строк — самый крупный в продукте (RELEASE-PLAN §C4). Разобран на четыре части:
//   • `report-detect.ts`     — опознание команд лиги по составам, без единой строчки вёрстки;
//   • `report-summary.tsx`   — шапка со счётом, полоса героев, баны;
//   • `report-scoreboard.tsx`— скорборд (в Ките артборда нет, собран из его атомов по месту);
//   • `report-extra.tsx`     — драфт, таланты, способности, покупки.
// Здесь осталась оболочка: адрес, загрузка, вкладки и раскладка блоков.

const TABS = [
  { key: "report", label: "Отчёт" },
  { key: "extra", label: "Доп. статистика" },
  { key: "vision", label: "Варды" },
  { key: "export", label: "Экспорт PNG" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const SOURCES: { key: MatchSource; label: string; hint: string }[] = [
  { key: "opendota", label: "OpenDota", hint: "Полный разбор: график золота, тайминги покупок, события, ники" },
  { key: "steam", label: "Steam", hint: "Первоисточник Valve: без графика золота, таймингов покупок, событий и ников" },
];

/** Ряд пилюль Кита — та же форма, что у подвкладок раздела (`sub-nav.tsx`), но состояние в адресе. */
function Pills<T extends string>({
  items,
  value,
  onPick,
  small = false,
}: {
  items: readonly { key: T; label: string; hint?: string }[];
  value: T;
  onPick: (key: T) => void;
  small?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((t) => (
        <button
          key={t.key}
          type="button"
          title={t.hint}
          aria-pressed={t.key === value}
          onClick={() => onPick(t.key)}
          className={`inline-flex shrink-0 rounded-[14px] font-black transition-[box-shadow,transform,background] ${
            small ? "px-3.5 py-[7px] text-xs" : "px-4 py-[9px] text-[13px]"
          } ${
            t.key === value
              ? "bg-accent-fill text-[var(--on-accent)] cushion-control"
              : "bg-surface text-muted cushion-field hover:text-ink"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function MatchReportView({ matchId, canArchive }: { matchId: string; canArchive: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Источник и вкладка живут в адресе, а не в state: ссылка воспроизводит ровно то, что видел отправитель.
  const src: MatchSource = params.get("src") === "steam" ? "steam" : "opendota";
  const tab: Tab = (TABS.find((t) => t.key === params.get("tab")) ?? TABS[0]).key;

  // Ответ помечен запросом, на который он пришёл (id + источник). Отдельного флага «грузится» нет:
  // пока метка не совпала с текущим адресом — на экране загрузка, а поздний ответ на прошлый
  // запрос просто не совпадёт меткой и ничего не перепишет.
  const key = `${matchId}|${src}`;
  const [data, setData] = useState<{ key: string; match: MatchReport | null; error: string | null }>({
    key: "",
    match: null,
    error: null,
  });
  // Ручные правки названий: печатаются локально, в адрес уходят по уходу из поля (см. TeamSide).
  const [manual, setManual] = useState({ radiant: params.get("radiant") ?? "", dire: params.get("dire") ?? "" });
  const roster = useRosterTeams();

  /** Правка адреса без записи в историю: назад из отчёта должно вести на форму, а не на прошлую вкладку. */
  function patchUrl(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Матч грузится по адресу: сменился id или источник — перезапрос.
  useEffect(() => {
    fetch(`/api/${src}/match/${matchId}`)
      .then(async (r) => {
        const json = await r.json();
        if (!json.ok) throw new Error(json.error ?? "Ошибка запроса");
        return json.match as MatchReport;
      })
      .then((match) => setData({ key: `${matchId}|${src}`, match, error: null }))
      .catch((e: unknown) =>
        setData({ key: `${matchId}|${src}`, match: null, error: e instanceof Error ? e.message : String(e) }),
      );
  }, [matchId, src]);

  const loading = data.key !== key;
  const match = loading ? null : data.match;
  const error = loading ? null : data.error;

  const { detected, withRosterNames } = useDetectedTeams(roster, match?.players);

  const bySide = (side: PlayerReport["side"]) =>
    withRosterNames((match?.players.filter((p) => p.side === side) ?? []).slice().sort((a, b) => a.pos - b.pos));
  const radiant = bySide("radiant");
  const dire = bySide("dire");
  const byPos = [...radiant, ...dire];

  // Итоговые названия сторон — производные (не в state), поэтому распознавание срабатывает и когда
  // ростер догрузился после матча: ручной ввод → команда по составу → название из OpenDota → пусто.
  const names = {
    radiant: manual.radiant || detected.radiant?.name || match?.radiantTeam || "",
    dire: manual.dire || detected.dire?.name || match?.direTeam || "",
  };
  const setNames = (u: (s: { radiant: string; dire: string }) => { radiant: string; dire: string }) =>
    setManual((m) => u({ radiant: m.radiant, dire: m.dire }));
  const commitNames = () => patchUrl({ radiant: manual.radiant || null, dire: manual.dire || null });

  // Лого и тег берём у РАСПОЗНАННОГО объекта команды, а не ищем заново по имени: две команды из
  // разных дивизионов могут называться одинаково (ReMix в D1 и D2 — разные записи, разные лого),
  // и поиск по строке «ReMix» взял бы первую попавшуюся. Ручной ввод имени резолвим по названию.
  const rosterTeams = {
    radiant: manual.radiant ? teamByName(roster, manual.radiant) : detected.radiant ?? teamByName(roster, names.radiant),
    dire: manual.dire ? teamByName(roster, manual.dire) : detected.dire ?? teamByName(roster, names.dire),
  };
  // Лого: наш ассет по названию → лого OpenDota → монограмма (в TeamCrest).
  const logos = {
    radiant: rosterTeams.radiant?.logo ?? match?.radiantLogo ?? null,
    dire: rosterTeams.dire?.logo ?? match?.direLogo ?? null,
  };
  // Теги команд для бейджей и карточек: ростер → OpenDota → инициалы введённого имени.
  const tags = {
    radiant: (rosterTeams.radiant?.tag || match?.radiantTag || initials(names.radiant || "Свет")).slice(0, 4),
    dire: (rosterTeams.dire?.tag || match?.direTag || initials(names.dire || "Тьма")).slice(0, 4),
  };
  // Максимум net worth в матче — база для полосок ценности в скорборде.
  const maxNet = Math.max(1, ...(match?.players.map((p) => p.netWorth) ?? [1]));

  return (
    <main className="flex-1 px-4 py-8 font-pouf md:px-6">
      <div className={`mx-auto w-full ${SITE_MAX_W} space-y-4`}>
        {/* Шапка отчёта: возврат к форме, номер матча и переключатель источника. */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-surface px-4 py-3 cushion-card">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Link href="/match" title="К вводу другого матча" className={buttonClasses({ variant: "quiet", size: "sm" })}>
              ← Другой матч
            </Link>
            <h1 className="truncate text-lg font-black uppercase tracking-[-0.3px] text-ink md:text-xl">
              Postgame <span className="tabular-nums text-muted">#{matchId}</span>
            </h1>
            {match && !match.parsed && (
              <span className="text-[11px] font-black text-[var(--color-warn-ink)]" title="OpenDota ещё не разобрала реплей">
                не распарсен
              </span>
            )}
          </div>
          {/* Источник — часть адреса: «почему тут пустой график» видно и в ссылке, и в интерфейсе. */}
          <Pills
            small
            items={SOURCES}
            value={src}
            onPick={(k) => patchUrl({ src: k === "opendota" ? null : k })}
          />
        </div>

        {loading && (
          <p className="rounded-control bg-surface px-3 py-2 text-sm font-bold text-muted cushion-field">
            Загружаю матч из {src === "steam" ? "Steam" : "OpenDota"}…
          </p>
        )}

        {error && (
          <div className="flex flex-wrap items-center gap-3 rounded-control bg-warn px-3 py-2 text-sm font-bold text-[var(--color-warn-ink)]">
            {error}
            {/* Второй источник живёт независимо: когда OpenDota лежит, разбор всё равно соберётся. */}
            <button
              type="button"
              onClick={() => patchUrl({ src: src === "opendota" ? "steam" : null })}
              className="rounded-[10px] bg-[rgba(255,255,255,0.55)] px-2 py-0.5 text-xs font-black text-[var(--color-warn-ink)] hover:bg-[rgba(255,255,255,0.85)]"
            >
              Попробовать {src === "opendota" ? "Steam" : "OpenDota"}
            </button>
          </div>
        )}

        {match && (
          <>
            <Pills items={TABS} value={tab} onPick={(k) => patchUrl({ tab: k === "report" ? null : k })} />

            {tab === "report" && (
              <>
                {/* Сводка матча единым блоком: шапка → герои → баны → карта строений и события
                    рядом с графиком преимущества. */}
                <div className="divide-y divide-hairline overflow-hidden rounded-card bg-surface cushion-card">
                  <div className="p-3 md:p-4">
                    <ScoreHeader match={match} names={names} setNames={setNames} commitNames={commitNames} logos={logos} />
                  </div>
                  <div className="p-3">
                    <HeroStrip radiant={radiant} dire={dire} />
                  </div>
                  <div className="px-3 py-2">
                    <BansStrip picksBans={match.picksBans} />
                  </div>
                  {/* карта — узкая фиксированная колонка, график забирает всю остальную ширину */}
                  <div className="grid gap-4 p-3 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <div className="space-y-3">
                      <BuildingMap buildings={match.buildings} radiantWin={match.radiantWin} />
                      <EventBadges events={match.events} tags={tags} />
                    </div>
                    {match.goldAdv.length >= 2 && (
                      <div className="min-w-0">
                        <AdvantageChart gold={match.goldAdv} xp={match.xpAdv} />
                      </div>
                    )}
                  </div>
                </div>

                <CardScoreboard
                  radiant={radiant}
                  dire={dire}
                  names={names}
                  logos={logos}
                  tags={tags}
                  maxNet={maxNet}
                  radiantScore={match.radiantScore}
                  direScore={match.direScore}
                  radiantWin={match.radiantWin}
                />
              </>
            )}

            {tab === "extra" && (
              <>
                <div className="rounded-card bg-surface p-4 cushion-card">
                  <div className="mb-3 text-[11px] font-extrabold uppercase tracking-widest text-muted">
                    Скиллы и покупки (по игрокам)
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {byPos.map((p, i) => (
                      <PlayerDetails key={i} p={p} />
                    ))}
                  </div>
                </div>
                <div className="rounded-card bg-surface p-4 cushion-card">
                  <Draft picksBans={match.picksBans} names={names} />
                </div>
              </>
            )}

            {tab === "vision" && (
              match.wards?.length ? (
                <VisionMap wards={match.wards} durationSeconds={match.durationSeconds} sideLabels={names} />
              ) : (
                <div className="rounded-card bg-surface p-6 text-center text-sm font-bold text-muted cushion-card">
                  Расстановка вардов доступна только у распарсенных матчей OpenDota.
                  {src === "steam" && " Переключитесь на источник OpenDota."}
                </div>
              )
            )}

            {tab === "export" && (
              <div className="rounded-card bg-surface p-4 cushion-card">
                {/* В архив уходит подпись ровно с теми названиями, что нарисованы на картинке. */}
                <PostgameExport
                  match={match}
                  names={names}
                  tags={tags}
                  logos={logos}
                  canArchive={canArchive}
                  meta={{
                    matchId: match.matchId,
                    source: src,
                    radiant: names.radiant || "Свет",
                    dire: names.dire || "Тьма",
                    radiantScore: match.radiantScore,
                    direScore: match.direScore,
                    radiantWin: match.radiantWin,
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
