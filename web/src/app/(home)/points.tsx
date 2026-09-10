import Link from "next/link";
import { tpLeaderboard, type TpRow } from "@/lib/tp";
import { playerPath } from "@/lib/profiles";
import { Eyebrow } from "@/components/pouf/text";
import { EmptyState } from "@/components/pouf/feedback";
import { PlayerAvatar } from "@/app/(public)/roster/_components/avatar";

// Очки на витрине — верхушка сезонного зачёта TP плюс своя строка вошедшего.
//
// Зачем своя строка: у зачёта из ста человек топ-5 не отвечает на вопрос «а я где». Показываем
// место игрока отдельной строкой под списком — и только если он в зачёте есть и в пятёрку не
// попал; иначе строка дублировала бы саму себя.
//
// Тройку лидеров выделяем формой места, а не эмодзи-медалями: в интерфейсе их нет с Э3b.

const PODIUM = 3;

function Row({ row, me = false }: { row: TpRow; me?: boolean }) {
  const podium = row.place <= PODIUM;
  return (
    <Link
      href={playerPath({ id: row.id, slug: row.slug })}
      className={`flex items-center gap-3 rounded-control px-3 py-2.5 transition hover:cushion-row ${
        me ? "bg-surface-2 cushion-field" : "hover:bg-surface-2"
      }`}
    >
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-pill text-[13px] font-black tabular-nums ${
          podium ? "bg-accent-fill text-[var(--on-accent)] cushion-blob" : "text-ink-subtle"
        }`}
      >
        {row.place}
      </span>
      <PlayerAvatar photo={row.photo} nickname={row.nickname} size={36} shape="circle" />
      <span className="min-w-0 flex-1 truncate text-[14.5px] font-extrabold text-ink">
        {row.nickname}
        {me && <span className="ml-2 text-[12px] font-extrabold text-ink-subtle">это вы</span>}
      </span>
      <span className="shrink-0 text-[15px] font-black tabular-nums text-ink">{row.score}</span>
    </Link>
  );
}

export async function PointsBlock({
  tournament,
  playerId,
}: {
  tournament: { id: number; slug: string; name: string; short: string | null } | null;
  playerId: number | null;
}) {
  const { rows, me, total } = await tpLeaderboard(tournament?.id ?? null, { playerId });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Eyebrow>Очки TP{tournament ? ` · ${tournament.short ?? tournament.name}` : ""}</Eyebrow>
        {tournament && total > 0 && (
          <Link
            href={`/tournaments/${tournament.slug}/tp`}
            className="text-[13px] font-extrabold text-[var(--accent-ink)] hover:underline"
          >
            Весь зачёт · {total}
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="star" title="Очков ещё не начисляли">
          TP получают за MVP матча и вклад в лигу. Как только оператор проставит первые баллы, здесь
          встанет верхушка зачёта.
        </EmptyState>
      ) : (
        <div className="rounded-card bg-surface p-2 cushion-card">
          {rows.map((r) => (
            <Row key={r.id} row={r} me={r.id === playerId} />
          ))}
          {/* Своя строка — только если вошедший в зачёте есть и в показанную верхушку не попал. */}
          {me && me.place > rows.length && (
            <div className="mt-1 border-t border-hairline pt-1">
              <Row row={me} me />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
