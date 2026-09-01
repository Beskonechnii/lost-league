import Link from "next/link";
import { listPlayers } from "@/lib/roster-data";
import { teamAccent } from "@/lib/profiles";
import { roleLabel } from "@/lib/roles";
import { can } from "@/lib/account";
import { notFound } from "next/navigation";
import { tournamentBySlug } from "@/lib/tournaments";
import { tpByTournament } from "@/lib/tp";
import { SectionHeader } from "@/components/pouf/blocks";
import { PlayerAvatar } from "@/app/(public)/roster/_components/avatar";

export const dynamic = "force-dynamic";

export const metadata = { title: "TP" };

// Медали тройки лидеров — только визуальный акцент, порядок задаёт tp.
const MEDAL = ["🥇", "🥈", "🥉"];

// Публичный зачёт TP: очки MVP, оператор проставляет их вручную (/admin/tp).
// Зачёт **турнирный**, поэтому и живёт внутри адреса турнира — вкладкой в его строке контекста.
// Старый общий адрес /tp остался редиректом на текущий турнир. `?all=1` — сумма за всё время
// (она же `Player.tp`, кеш реестра начислений — см. src/lib/tp.ts).
// Игроки с нулём в таблицу не идут — она про тех, кто уже что-то набрал.
export default async function TpPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ all?: string }>;
}) {
  const { slug } = await params;
  const all = (await searchParams).all === "1";
  const [players, current, authed] = await Promise.all([
    listPlayers(),
    tournamentBySlug(slug),
    can("tp.edit"), // ссылка на панель начисления — только тем, кто начисляет
  ]);
  if (!current) notFound();
  const season = await tpByTournament(all ? null : current.id);
  const scoreOf = (id: number, lifetime: number) => (all ? lifetime : season.get(id) ?? 0);
  const ranked = players
    .map((p) => ({ ...p, score: scoreOf(p.id, p.tp) }))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader
        eyebrow="Сезонный зачёт"
        title="TP"
        aside={
          <span className="flex flex-wrap items-center gap-2">
            <span>Очки MVP{all ? " за всё время" : ` · ${current.short ?? current.name}`}</span>
            <Link
              href={all ? `/tournaments/${slug}/tp` : `/tournaments/${slug}/tp?all=1`}
              className="rounded-[12px] bg-surface-2 px-3 py-1 text-xs font-black hover:text-[var(--accent-ink)]"
            >
              {all ? "Текущий турнир" : "За всё время"}
            </Link>
          </span>
        }
      />

      {ranked.length === 0 ? (
        <div className="rounded-card bg-surface p-8 text-center text-sm font-bold text-muted cushion-field">
          Пока ни у кого нет TP.
          {authed && (
            <>
              {" "}
              Проставить можно в{" "}
              <Link href="/admin/tp" className="text-[var(--accent-ink)] hover:underline">
                админке
              </Link>
              .
            </>
          )}
        </div>
      ) : (
        <ol className="space-y-2">
          {ranked.map((p, i) => {
            const accent = p.main ? teamAccent(p.main.team) : "#a855f7";
            return (
              <li key={p.id}>
                <Link
                  href={`/roster/players/${p.id}`}
                  className="flex items-center gap-4 rounded-card bg-surface px-4 py-3 cushion-row transition-transform hover:-translate-y-px hover:cushion-row-hover"
                >
                  {/* Место: медаль для тройки, номер для остальных — одинаковой ширины, чтобы ники встали в столбец */}
                  <span className="w-9 shrink-0 text-center text-lg font-black tabular-nums text-ink-muted">
                    {MEDAL[i] ?? i + 1}
                  </span>
                  <PlayerAvatar photo={p.photo} nickname={p.nickname} color={accent} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-black text-ink">{p.nickname}</div>
                    <div className="truncate text-xs font-bold text-muted">
                      {p.main
                        ? [p.main.team.name, roleLabel(p.main.role)].filter(Boolean).join(" · ")
                        : "без команды"}
                    </div>
                  </div>
                  <span className="shrink-0 text-right">
                    <span className="text-xl font-black tabular-nums text-[var(--accent-ink)]">{p.score}</span>
                    <span className="ml-1 text-xs font-bold text-muted">TP</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
