import Link from "next/link";
import { tpLeaderboard, type TpRow } from "@/lib/tp";
import { shardLeaderboard } from "@/lib/shards";
import { playerPath } from "@/lib/profiles";
import { EmptyState } from "@/components/pouf/feedback";
import { PillLink } from "@/components/pouf/tabs";
import { ShardGlyph } from "@/components/pouf/shards";
import { shardGrade } from "@/lib/shard-grades";
import { PlayerAvatar } from "@/app/(public)/roster/_components/avatar";
import { Slab } from "./slab";

// Баллы на плите витрины — топ-10 по макету `design/home/Main.dc.html`: строка «место · ник ·
// баллы», лидер выделен мятной подушкой, два разреза вкладками в правом углу шапки.
//
// Разрезы — разные валюты, а не разные виды одного списка: TP спортивный и сезонный, осколки
// копятся за всё время (см. шапку `lib/shards.ts`). Поэтому у каждого свой лидерборд и своя
// ссылка «весь топ»: у TP она ведёт на страницу зачёта турнира, у осколков вести некуда —
// отдельной страницы топа нет, и выдумывать её ради симметрии не нужно.
//
// Разрез живёт в адресе (`/?p=shards`), как у матчей и турниров: ссылку на вкладку должно быть
// можно кинуть в чат (правило L4), и блок остаётся серверным.
//
// Своя строка вошедшего остаётся под списком: у зачёта из ста человек десятка не отвечает на
// вопрос «а я где». Показываем её, только если игрок в зачёте есть и в десятку не попал —
// иначе строка дублировала бы саму себя.

const CUTS = ["tp", "shards"] as const;
export type PointsCut = (typeof CUTS)[number];
export const isPointsCut = (v: string | undefined): v is PointsCut => (CUTS as readonly string[]).includes(v ?? "");

const CUT_LABELS: Record<PointsCut, string> = { tp: "TP", shards: "Shards" };

const TOP = 10;
/** Сколько строк видно на телефоне: в макете `Mobile.dc.html` топ укорочен до пяти. */
const TOP_MOBILE = 5;

function Row({
  row,
  me = false,
  hideOnPhone = false,
  shards = false,
}: {
  // `TpRow` и `ShardRow` совпадают по форме — списки рисует одна строка, см. шапку файла.
  row: TpRow;
  me?: boolean;
  hideOnPhone?: boolean;
  /** Разрез осколков: число идёт со знаком своей ступени, а не голой цифрой. */
  shards?: boolean;
}) {
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
      {/* У осколков к числу идёт кристалл своей ступени — то же, что в профиле: цвет знака
          говорит грейд, и колонка читается не только цифрой. Само число собрано здесь, а не
          готовым `ShardAmount`: тот жёстко красит цифру в `text-ink`, и в строке лидера она
          вышла бы серой посреди зелёного `--on-accent`. */}
      <span className="flex shrink-0 items-center gap-1.5">
        {shards && <ShardGlyph grade={shardGrade(row.score)} size="sm" />}
        <span className="text-[15px] font-black tabular-nums">{row.score}</span>
      </span>
    </Link>
  );
}

export async function PointsBlock({
  tournament,
  playerId,
  cut = "tp",
}: {
  tournament: { id: number; slug: string; name: string; short: string | null } | null;
  playerId: number | null;
  cut?: PointsCut;
}) {
  // Считаем оба разреза, а не выбранный: числа на вкладках должны стоять сразу, иначе счётчик
  // появляется только после перехода и вкладка выглядит пустой. Оба запроса дешёвые — свод по
  // уже посчитанным строкам, без похода за матчами.
  const [tp, shards] = await Promise.all([
    tpLeaderboard(tournament?.id ?? null, { limit: TOP, playerId }),
    shardLeaderboard({ limit: TOP, playerId }),
  ]);
  const { rows, me, total } = cut === "shards" ? shards : tp;
  const counts: Record<PointsCut, number> = { tp: tp.total, shards: shards.total };
  // Ссылка «весь топ» есть только у TP: страница зачёта турнира существует, страницы топа
  // осколков — нет, и заводить её ради симметрии вкладок не нужно.
  const more = cut === "tp" && tournament && total > 0
    ? { href: `/tournaments/${tournament.slug}/tp`, label: `весь топ · ${total}` }
    : undefined;

  return (
    <Slab
      title="Баллы"
      aside={CUTS.map((c) => (
        <PillLink key={c} href={c === "tp" ? "/" : `/?p=${c}`} active={c === cut} size="sm" count={counts[c]} scroll={false}>
          {CUT_LABELS[c]}
        </PillLink>
      ))}
      more={more}
    >
      {rows.length === 0 ? (
        cut === "shards" ? (
          <EmptyState icon="star" title="Осколков ещё ни у кого нет">
            Осколки дают за вехи в системе — модерацию, привязку Steam и телеграма, заполненную
            анкету. Первый, кто их пройдёт, встанет здесь.
          </EmptyState>
        ) : (
          <EmptyState icon="star" title="Очков ещё не начисляли">
            TP получают за MVP матча и вклад в лигу. Как только оператор проставит первые баллы, здесь
            встанет верхушка зачёта.
          </EmptyState>
        )
      ) : (
        // `flex-1` — из макета (`.top10`): плиты нижнего ряда равной высоты, и список должен
        // занимать её целиком, а не висеть карточкой в верхней трети пустой подложки.
        <div className="flex flex-1 flex-col gap-0.5 rounded-card bg-surface p-2 cushion-card">
          {rows.map((r, i) => (
            <Row key={r.id} row={r} me={r.id === playerId} hideOnPhone={i >= TOP_MOBILE} shards={cut === "shards"} />
          ))}
          {me && me.place > rows.length && (
            <div className="mt-1 border-t border-hairline pt-1">
              <Row row={me} me shards={cut === "shards"} />
            </div>
          )}
        </div>
      )}
    </Slab>
  );
}
