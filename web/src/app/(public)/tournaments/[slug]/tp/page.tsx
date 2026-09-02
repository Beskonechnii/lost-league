import Link from "next/link";
import { listPlayers } from "@/lib/roster-data";
import { teamAccent } from "@/lib/profiles";
import { roleLabel } from "@/lib/roles";
import { can } from "@/lib/account";
import { notFound } from "next/navigation";
import { tournamentBySlug } from "@/lib/tournaments";
import { tpByTournament } from "@/lib/tp";
import { SectionHeader } from "@/components/pouf/blocks";
import { EmptyState } from "@/components/pouf/feedback";
import { PillLink } from "@/components/pouf/tabs";
import { PlayerAvatar } from "@/app/(public)/roster/_components/avatar";

export const dynamic = "force-dynamic";

export const metadata = { title: "TP" };

// Тройку лидеров показываем не эмодзи-медалями, а формой места: у первых трёх номер лежит на
// акцентной подушке Кита, у остальных — просто цифра. Эмодзи в интерфейсе не осталось с Э3b, и
// «🥇» рядом с Nunito читался как чужой шрифт.
const PODIUM = 3;

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
            {/* Разрез — пара пилюль Кита, а не одна кнопка-переключатель: видно оба варианта
                и то, в каком из них сейчас стоишь. */}
            <PillLink href={`/tournaments/${slug}/tp`} active={!all}>
              Текущий турнир
            </PillLink>
            <PillLink href={`/tournaments/${slug}/tp?all=1`} active={all}>
              За всё время
            </PillLink>
          </span>
        }
      />

      {ranked.length === 0 ? (
        <EmptyState icon="star" title="Пока ни у кого нет TP">
          Очки MVP проставляет организатор после игрового дня
          {authed ? (
            <>
              {" — "}
              <Link href="/admin/tp" className="font-black text-[var(--accent-ink)] underline-offset-4 hover:underline">
                панель начисления
              </Link>
              .
            </>
          ) : (
            "."
          )}
        </EmptyState>
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
                  {/* Место всегда одной ширины, чтобы ники встали в столбец; тройка лидеров — на подушке */}
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-[14px] text-base font-black tabular-nums ${
                      i < PODIUM ? "bg-accent-fill text-[var(--on-accent)] cushion-blob" : "text-muted"
                    }`}
                  >
                    {i + 1}
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
