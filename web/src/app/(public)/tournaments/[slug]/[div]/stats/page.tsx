import Link from "next/link";
import { notFound } from "next/navigation";
import { divisionOfTournament } from "@/lib/tournaments";
import { getLeaders, METRICS, type Subject } from "@/lib/leaders";
import { BRACKETS, isBracket, isStage, STAGES } from "@/lib/stages";
import { SectionHeader } from "@/components/pouf/blocks";

export const dynamic = "force-dynamic";

// Рейтинги турнира: одни и те же суммы, разрезанные стадией и группой. Фильтры живут в query,
// поэтому любой разрез — это ссылка, которую можно кинуть в чат (как и у постгейма).

type Query = { stage?: string; group?: string; bracket?: string; kind?: string };

const nf = new Intl.NumberFormat("ru-RU");
const fmt = (v: number, decimals = 0) =>
  decimals ? v.toLocaleString("ru-RU", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : nf.format(Math.round(v));

/** Ссылка-фильтр: тот же адрес с подменённым параметром. `null` — параметр убрать (значение «все»).
 *  Пилюля-«подушка» pouf: активная вжата (cushion-control, фиолет), неактивная — тихий контур. */
function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-[14px] px-3.5 py-[7px] text-[13px] font-black transition-[box-shadow,transform,background] ${
        active
          ? "bg-accent-fill text-[var(--on-accent)] cushion-control-active [transform:translateY(1px)]"
          : "bg-surface text-ink-muted cushion-field hover:text-ink hover:cushion-field-focus"
      }`}
    >
      {children}
    </Link>
  );
}

function Board({
  title,
  hint,
  rows,
  decimals,
  perLabel,
}: {
  title: string;
  hint: string;
  rows: { subject: Subject; value: number; per: number | null }[];
  decimals: number;
  perLabel?: string;
}) {
  const top = rows[0]?.value ?? 0;
  return (
    <section className="overflow-hidden rounded-card bg-surface font-pouf cushion-card">
      <div className="border-b border-hairline bg-gradient-to-r from-accent-fill/[0.16] to-transparent px-4 py-3">
        <div className="text-sm font-black tracking-[-0.2px] text-ink">{title}</div>
        <div className="text-[11px] font-bold text-muted">{hint}</div>
      </div>
      {rows.length === 0 ?
        <p className="px-4 py-4 text-xs font-bold text-muted">Нет карт в этом разрезе.</p>
      : <ol className="divide-y divide-hairline">
          {rows.map((r, i) => {
            const leader = i === 0;
            return (
              <li
                key={`${r.subject.kind}-${r.subject.id}`}
                className="group relative flex items-center gap-2.5 px-4 py-2"
              >
                {/* полоса-доля от лидера: строку читаешь глазами, не сравнивая цифры */}
                <span
                  className={`absolute inset-y-0 left-0 ${leader ? "bg-accent-fill/[0.20]" : "bg-accent-fill/[0.09]"}`}
                  style={{ width: `${top > 0 ? Math.max(2, (r.value / top) * 100) : 0}%` }}
                  aria-hidden
                />
                <span
                  className={`relative grid h-6 w-6 shrink-0 place-items-center rounded-[10px] text-[11px] font-black tabular-nums ${
                    leader ? "bg-accent-fill text-[var(--on-accent)]" : "text-ink-subtle"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="relative w-9 shrink-0 truncate text-[10px] font-bold text-ink-subtle">
                  {r.subject.tag}
                </span>
                <Link
                  href={r.subject.kind === "team" ? `/roster/teams/${r.subject.id}` : `/roster/players/${r.subject.id}`}
                  className="relative truncate text-sm font-black transition-colors group-hover:text-[var(--accent-ink)]"
                >
                  {r.subject.name}
                </Link>
                <span className="relative ml-auto shrink-0 text-right">
                  <span className="block text-sm font-black tabular-nums text-ink">{fmt(r.value, decimals)}</span>
                  {r.per != null && perLabel && (
                    <span className="block text-[10px] font-bold tabular-nums text-muted">
                      {/* дробная часть осмысленна у «убийств за карту», а у «урона за карту» — шум */}
                      {fmt(r.per, r.per < 100 ? 1 : 0)} {perLabel}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      }
    </section>
  );
}

export default async function StatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; div: string }>;
  searchParams: Promise<Query>;
}) {
  const { slug, div } = await params;
  const q = await searchParams;
  const division = await divisionOfTournament(slug, div);
  if (!division) notFound();

  const stage = isStage(q.stage) ? q.stage : undefined;
  // Группа осмысленна только в группе, половина сетки — только в плей-офф: разрез в другой стадии
  // не сужал бы выборку, а обнулял её.
  const group = stage === "group" ? q.group || undefined : undefined;
  const bracket = stage === "playoff" && isBracket(q.bracket) ? q.bracket : undefined;
  const kind = q.kind === "teams" ? "teams" : "players";

  const data = await getLeaders({ divisionId: division.id, stage, group, bracket });
  const subjects = kind === "teams" ? data.teams : data.players;

  const base = `/tournaments/${slug}/${division.slug}/stats`;
  const link = (patch: Query) => {
    const next = new URLSearchParams();
    const merged = { stage: q.stage, group: q.group, bracket: q.bracket, kind: q.kind, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    const s = next.toString();
    return s ? `${base}?${s}` : base;
  };


  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader
        eyebrow={`${division.label ?? division.name} · рейтинги`}
        title="Статистика"
        aside={
          <>
            Карт в разрезе: <span className="text-ink-muted">{data.games}</span>
            {data.games > 0 && data.parsedGames < data.games && (
              <span className="text-amber-700"> · распарсено {data.parsedGames}</span>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] font-extrabold uppercase tracking-widest text-muted">Кто</span>
          <Chip href={link({ kind: undefined })} active={kind === "players"}>
            Игроки
          </Chip>
          <Chip href={link({ kind: "teams" })} active={kind === "teams"}>
            Команды
          </Chip>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] font-extrabold uppercase tracking-widest text-muted">Стадия</span>
          <Chip href={link({ stage: undefined, group: undefined, bracket: undefined })} active={!stage}>
            Весь турнир
          </Chip>
          {STAGES.map((s) => (
            <Chip key={s.key} href={link({ stage: s.key, group: undefined, bracket: undefined })} active={stage === s.key}>
              {s.label}
            </Chip>
          ))}
        </div>

        {stage === "group" && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-extrabold uppercase tracking-widest text-muted">Группа</span>
            <Chip href={link({ group: undefined })} active={!group}>
              Обе
            </Chip>
            {["A", "B"].map((g) => (
              <Chip key={g} href={link({ group: g })} active={group === g}>
                {g}
              </Chip>
            ))}
          </div>
        )}

        {stage === "playoff" && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-extrabold uppercase tracking-widest text-muted">Сетка</span>
            <Chip href={link({ bracket: undefined })} active={!bracket}>
              Вся
            </Chip>
            {BRACKETS.map((b) => (
              <Chip key={b.key} href={link({ bracket: b.key })} active={bracket === b.key}>
                {b.short}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {data.games === 0 ?
        <p className="rounded-card bg-surface p-6 text-sm font-bold text-muted cushion-field">
          В этом разрезе нет ни одной карты. Карты попадают сюда, когда их привязывают к встрече —{" "}
          <Link href="/admin/series" className="text-[var(--accent-ink)] hover:underline">
            архив серий
          </Link>
          .
        </p>
      : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {METRICS.map((m) => {
            const rows = subjects
              .map((s) => ({ subject: s, value: m.value(s.totals), per: m.per ? m.per(s.totals) : null }))
              // Винрейт без карт — не ноль, а «нет данных»; такие субъекты в рейтинг не берём.
              .filter((r) => r.subject.totals.games > 0)
              .sort((a, b) => b.value - a.value || b.subject.totals.games - a.subject.totals.games)
              .slice(0, 10);
            return (
              <Board key={m.key} title={m.label} hint={m.hint} rows={rows} decimals={m.decimals ?? 0} perLabel={m.perLabel} />
            );
          })}
        </div>
      }
    </div>
  );
}
