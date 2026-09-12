import Link from "next/link";
import { tpLeaderboard, type TpRow } from "@/lib/tp";
import { playerPath } from "@/lib/profiles";
import { EmptyState } from "@/components/pouf/feedback";
import { PlayerAvatar } from "@/app/(public)/roster/_components/avatar";
import { Slab } from "./slab";

// Баллы на плите витрины — топ-10 сезонного зачёта TP по макету `design/home/Main.dc.html`:
// строка «место · ник · баллы», лидер выделен мятной подушкой.
//
// Второго разреза (таб «Shards» из макета) здесь нет: лидерборда по осколкам в `lib/shards.ts`
// не существует, а заводить его запрещает `MVP.md` §2 — осколки не развиваем до ответа, на что
// они тратятся. Блок едет одним разрезом TP.
//
// Своя строка вошедшего остаётся под списком: у зачёта из ста человек десятка не отвечает на
// вопрос «а я где». Показываем её, только если игрок в зачёте есть и в десятку не попал —
// иначе строка дублировала бы саму себя.

const TOP = 10;
/** Сколько строк видно на телефоне: в макете `Mobile.dc.html` топ укорочен до пяти. */
const TOP_MOBILE = 5;

function Row({ row, me = false, hideOnPhone = false }: { row: TpRow; me?: boolean; hideOnPhone?: boolean }) {
  const lead = row.place === 1;
  return (
    <Link
      href={playerPath({ id: row.id, slug: row.slug })}
      className={`flex h-10 items-center gap-2.5 rounded-control px-3 transition ${
        hideOnPhone ? "max-sm:hidden" : ""
      } ${
        lead
          ? "bg-accent-fill text-[var(--on-accent)] cushion-blob"
          : me
            ? "bg-surface-2 cushion-field"
            : "hover:bg-surface-2"
      }`}
    >
      <span className={`w-7 shrink-0 text-center text-[15px] font-black tabular-nums ${lead ? "" : "text-muted"}`}>
        {row.place}
      </span>
      <PlayerAvatar photo={row.photo} nickname={row.nickname} size={30} shape="circle" />
      <span className="min-w-0 flex-1 truncate text-[15px] font-black tracking-[-0.2px]">
        {row.nickname}
        {me && !lead && <span className="ml-2 text-[12px] font-extrabold text-ink-subtle">это вы</span>}
      </span>
      <span className="shrink-0 text-[15px] font-black tabular-nums">{row.score}</span>
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
  const { rows, me, total } = await tpLeaderboard(tournament?.id ?? null, { limit: TOP, playerId });

  return (
    <Slab
      title="Баллы"
      aside={tournament && <span className="text-xs font-extrabold uppercase tracking-[0.8px] text-ink-subtle">{tournament.short ?? tournament.name}</span>}
      more={tournament && total > 0 ? { href: `/tournaments/${tournament.slug}/tp`, label: `весь топ · ${total}` } : undefined}
    >
      {rows.length === 0 ? (
        <EmptyState icon="star" title="Очков ещё не начисляли">
          TP получают за MVP матча и вклад в лигу. Как только оператор проставит первые баллы, здесь
          встанет верхушка зачёта.
        </EmptyState>
      ) : (
        // `flex-1` — из макета (`.top10`): плиты нижнего ряда равной высоты, и список должен
        // занимать её целиком, а не висеть карточкой в верхней трети пустой подложки.
        <div className="flex flex-1 flex-col gap-0.5 rounded-card bg-surface p-2 cushion-card">
          {rows.map((r, i) => (
            <Row key={r.id} row={r} me={r.id === playerId} hideOnPhone={i >= TOP_MOBILE} />
          ))}
          {me && me.place > rows.length && (
            <div className="mt-1 border-t border-hairline pt-1">
              <Row row={me} me />
            </div>
          )}
        </div>
      )}
    </Slab>
  );
}
