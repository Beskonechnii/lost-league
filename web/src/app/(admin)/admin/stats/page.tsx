import Link from "next/link";
import { getLeaders, METRICS, type Subject } from "@/lib/leaders";
import { getDivisions } from "@/lib/tournaments";
import { isStage } from "@/lib/stages";
import { Eyebrow, SITE_MAX_W } from "@/app/_components/ui";
import { denyUnlessPermission } from "../../_components/permission-gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Показатели" };

// Личный доступ (живёт под /admin, значит за паролем): сводка «вопрос → топ-5» по всем метрикам
// сразу. Отличается от публичной страницы статистики дивизиона: там одна метрика крупной таблицей,
// тут — все метрики компактной решёткой, чтобы оператор одним взглядом видел лидеров турнира.
//
// Источник — тот же архив серий (getLeaders): технические/ошибочные карты в него не привязывают,
// поэтому отсеивать их отдельно не нужно — их тут просто нет (см. развилку ① в роадмапе).
//
// Все разрезы (дивизион, стадия, игроки/команды) живут в query — ссылку с нужным срезом можно
// кинуть в чат, как у постгейма и публичных рейтингов.

type Query = { div?: string; stage?: string; kind?: string };

const nf = new Intl.NumberFormat("ru-RU");
const fmt = (v: number, decimals = 0) =>
  decimals ? v.toLocaleString("ru-RU", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : nf.format(Math.round(v));

/** Одна метрика: топ-5 субъектов по ней. */
function Board({ label, hint, rows, decimals, perLabel }: {
  label: string;
  hint: string;
  rows: { name: string; tag: string; value: number; per?: number }[];
  decimals?: number;
  perLabel?: string;
}) {
  return (
    <div className="rounded-card bg-surface p-4 cushion-card">
      <div className="mb-3">
        <div className="font-black text-ink">{label}</div>
        <div className="text-xs font-bold text-muted">{hint}</div>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm font-bold text-muted">Нет данных.</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={`${r.name}-${i}`} className="flex items-center gap-2 text-sm">
              <span className={`w-4 shrink-0 text-right text-xs tabular-nums ${i === 0 ? "font-black text-[var(--purple)]" : "text-ink-subtle"}`}>{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-bold text-ink">{r.name}</span>
                {r.tag && <span className="ml-1 text-xs text-muted">{r.tag}</span>}
              </span>
              <span className="shrink-0 text-right tabular-nums">
                <span className="font-black text-ink">{fmt(r.value, decimals)}</span>
                {r.per !== undefined && perLabel && (
                  <span className="ml-1 text-xs text-muted">{fmt(r.per, decimals ? decimals : 1)} {perLabel}</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default async function AdminStatsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const denied = await denyUnlessPermission("tools", "Показатели");
  if (denied) return denied;

  const q = await searchParams;
  const divisions = await getDivisions();
  const division = divisions.find((d) => d.slug === q.div)?.id; // undefined = оба дивизиона
  const stage = isStage(q.stage) ? q.stage : undefined; // undefined = вся дистанция
  const kind = q.kind === "teams" ? "teams" : "players";

  const data = await getLeaders({ divisionId: division, stage });
  const subjects: Subject[] = kind === "teams" ? data.teams : data.players;

  // Ссылка-фильтр: тот же адрес с подменённым параметром. Пустое значение убирает параметр («все»).
  const base = "/admin/stats";
  const link = (patch: Query) => {
    const merged = { div: q.div, stage: q.stage, kind: q.kind, ...patch };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };

  // key по href — иначе в .map (дивизионы) React ругается на отсутствие ключа.
  const chip = (href: string, active: boolean, children: React.ReactNode) => (
    <Link
      key={href}
      href={href}
      className={`rounded-[14px] px-3.5 py-[7px] text-[13px] font-black transition-[box-shadow,transform,background] ${
        active
          ? "bg-purple text-[var(--on-accent)] cushion-control"
          : "bg-surface text-ink-muted cushion-field hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 font-pouf md:px-6`}>
      <Eyebrow className="mb-2">Служебная часть · показатели</Eyebrow>
      <h1 className="text-[28px] font-black tracking-[-0.5px] text-ink md:text-4xl">Показатели турнира</h1>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap gap-2">
          {chip(link({ kind: undefined }), kind === "players", "Игроки")}
          {chip(link({ kind: "teams" }), kind === "teams", "Команды")}
        </div>
        <span className="text-hairline-strong">·</span>
        <div className="flex flex-wrap gap-2">
          {chip(link({ div: undefined }), !q.div, "Оба дивизиона")}
          {divisions.map((d) => chip(link({ div: d.slug }), q.div === d.slug, d.short))}
        </div>
        <span className="text-hairline-strong">·</span>
        <div className="flex flex-wrap gap-2">
          {chip(link({ stage: undefined }), !stage, "Вся дистанция")}
          {chip(link({ stage: "group" }), stage === "group", "Группа")}
          {chip(link({ stage: "playoff" }), stage === "playoff", "Плей-офф")}
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-subtle">
        {data.games} карт в выборке, из них распарсено {data.parsedGames} — метрики с пометкой «парс» (варды, стаки) считаются только по ним.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {METRICS.map((m) => {
          const ranked = subjects
            .map((s) => ({ name: s.name, tag: s.tag, value: m.value(s.totals), per: m.per?.(s.totals) }))
            .filter((r) => r.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
          return (
            <Board
              key={m.key}
              label={m.label}
              hint={m.hint}
              rows={ranked}
              decimals={m.decimals}
              perLabel={m.perLabel}
            />
          );
        })}
      </div>
    </main>
  );
}
