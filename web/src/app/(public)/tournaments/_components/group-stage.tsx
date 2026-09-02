import Link from "next/link";
import { qualificationOf } from "@/lib/qualification";
import type { GroupCell, GroupRow, GroupTable } from "@/lib/group-stage";
import { CrossCell, Points, TeamMark, ZoneLegend, zonesOf } from "@/components/pouf/table";

// Групповой этап по артборду Кита «Групповой этап»: слева блок группы (компактная таблица, зона
// выхода залита мятным), справа кросс-таблица «все со всеми» — ячейка это счёт серии глазами
// команды-строки. Только чтение: счёт из привязанных карт архива серий, правки — через /admin/series.
//
// Развёрнутая таблица с сортировкой, формой и разницей карт живёт на соседней вкладке «Таблица»
// (корень дивизиона). Здесь намеренно короткий набор колонок — блок группы должен помещаться
// рядом с сеткой, а не спорить с ней за ширину.

/** Строка блока группы: место, лого, команда, И, разница карт, очки. Кит: `.ggrid.grow`. */
function GroupRowLine({ r, size, relegation }: { r: GroupRow; size: number; relegation: boolean }) {
  const zone = qualificationOf(r.place, size, relegation);
  const up = zone === "upper";
  const diff = r.mapsWon - r.mapsLost;
  return (
    <Link
      href={`/roster/teams/${r.teamId}`}
      // Зона выхода — заливка строки, как в Ките: у блока группы нет места под рейку слева,
      // а сам смысл («эти проходят») важнее, чем единообразие с большой таблицей.
      // На узком экране «И» и «Р» уходят: пять колонок ужимают имя команды до одной буквы, а
      // сыгранные встречи и разница карт есть на соседней вкладке «Таблица».
      className={`mt-0.5 grid grid-cols-[28px_1fr_58px] items-center rounded-[18px] px-3 py-[9px] text-sm font-extrabold first:mt-0 sm:grid-cols-[28px_1fr_38px_44px_58px] ${
        up
          ? "bg-accent-fill text-[var(--on-accent)] cushion-blob"
          : zone === "out"
            ? "opacity-[.72] hover:bg-surface-1 hover:cushion-row"
            : "hover:bg-surface-1 hover:cushion-row"
      }`}
    >
      <span className={`text-center tabular-nums ${up ? "text-[var(--on-accent-muted)]" : "text-muted"}`}>
        {r.place}
      </span>
      <span className="flex min-w-0 items-center gap-2.5">
        <TeamMark logo={r.logo} tag={r.tag} name={r.name} size={30} />
        <span className={`truncate text-sm font-black ${up ? "" : "text-ink"}`}>{r.name}</span>
      </span>
      <span className={`hidden text-center tabular-nums sm:block ${up ? "text-[var(--on-accent-muted)]" : "text-muted"}`}>
        {r.played}
      </span>
      <span className={`hidden text-center tabular-nums sm:block ${up ? "text-[var(--on-accent-muted)]" : "text-muted"}`}>
        {diff > 0 ? `+${diff}` : diff < 0 ? `−${Math.abs(diff)}` : "0"}
      </span>
      <span className="text-center">
        <Points lead={r.place === 1}>{r.points}</Points>
      </span>
    </Link>
  );
}

/** Блок группы. Кит: `.gcard` — шапка с буквой группы, шапка колонок, строки. */
function GroupCard({ t }: { t: GroupTable }) {
  const left = t.expected - t.decided;
  return (
    <div className="rounded-[32px] bg-surface-1 p-5 font-pouf cushion-card xl:w-[24rem] xl:shrink-0">
      <div className="mb-3.5 flex items-center gap-3">
        <span className="grid h-9 min-w-9 place-items-center rounded-[14px] bg-accent-fill px-3 text-xl font-black text-[var(--on-accent)] cushion-control">
          {t.group}
        </span>
        <span className="text-xl font-black tracking-[-0.4px] text-ink">Группа {t.group}</span>
        <span className="ml-auto text-[11px] font-extrabold uppercase tracking-[1px] text-muted">
          {left > 0 ? `осталось ${left}` : "сыграна"}
        </span>
      </div>
      <div className="grid grid-cols-[28px_1fr_58px] px-3 pb-2 text-center text-[10px] font-extrabold uppercase tracking-[1px] text-muted sm:grid-cols-[28px_1fr_38px_44px_58px]">
        <span>#</span>
        <span className="text-left">Команда</span>
        <span className="hidden sm:block" title="Сыграно встреч">И</span>
        <span className="hidden sm:block" title="Разница карт">Р</span>
        <span>Очки</span>
      </div>
      {t.rows.map((r) => (
        <GroupRowLine key={r.teamId} r={r} size={t.rows.length} relegation={t.relegation} />
      ))}
      <ZoneLegend zones={zonesOf(t.relegation)} height={14} className="mt-3.5 border-t border-hairline pt-3" />
    </div>
  );
}

/** Одна ячейка кросс-таблицы: счёт глазами команды-строки, диагональ — своя клетка. */
function Cell({ cell, row, col }: { cell: GroupCell; row: GroupRow; col: GroupRow }) {
  if (row.teamId === col.teamId) return <CrossCell state="self">—</CrossCell>;
  if (!cell) return <CrossCell state="soon" title={`${row.name} — ${col.name}: встречи ещё нет`}>—</CrossCell>;
  const win = Number(cell.score.split(":")[0]) > Number(cell.score.split(":")[1]);
  return (
    <CrossCell
      state={win ? "win" : "loss"}
      dim={cell.guessed}
      title={`${row.name} — ${col.name}${cell.guessed ? " · счёт восстановлен расчётом" : ""}`}
    >
      {cell.score}
    </CrossCell>
  );
}

/** Кросс-таблица «все со всеми». Кит: `.cross` + `.ctab`. */
function CrossTable({ t }: { t: GroupTable }) {
  return (
    // Прокрутка внутри своего контейнера, а не всей страницей (UI-GUIDELINES §4, «Плотность»).
    <div className="min-w-0 flex-1 overflow-x-auto rounded-[32px] bg-surface-1 p-5 font-pouf cushion-card">
      <table className="border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-[7rem] px-1.5 py-1 text-left text-[11px] font-extrabold text-ink">
              Группа {t.group}
            </th>
            {t.rows.map((c) => (
              <th
                key={c.teamId}
                title={c.name}
                className="px-1.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.6px] text-muted"
              >
                {c.tag.slice(0, 4)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r, i) => (
            <tr key={r.teamId}>
              {/* липкая: при прокрутке сетки вбок иначе непонятно, чья это строка */}
              {/* Слева тег, а не полное имя: полные имена стоят рядом в блоке группы, а лишние
                  сто пикселей здесь стоят двух колонок сетки. Кит рисует кросс-таблицу отдельно
                  стоящей, поэтому там имена нужны. */}
              <th className="sticky left-0 z-10 bg-surface-1 px-1.5 py-1 text-left">
                <Link
                  href={`/roster/teams/${r.teamId}`}
                  title={r.name}
                  className="flex items-center gap-2.5 group"
                >
                  <TeamMark logo={r.logo} tag={r.tag} name={r.name} size={30} />
                  <span className="truncate text-[13px] font-black uppercase tracking-[0.4px] text-ink group-hover:underline">
                    {r.tag}
                  </span>
                </Link>
              </th>
              {t.rows.map((c, j) => (
                <td key={c.teamId}>
                  <Cell cell={t.grid[i][j]} row={r} col={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GroupStage({ tables }: { tables: GroupTable[] }) {
  return (
    <div className="space-y-8 font-pouf">
      {tables.map((t) => (
        <section key={t.group} className="flex flex-col gap-5 xl:flex-row xl:items-start">
          <GroupCard t={t} />
          <CrossTable t={t} />
        </section>
      ))}
    </div>
  );
}
