import Link from "next/link";
import { QUALIFICATION, qualificationOf } from "@/lib/qualification";
import type { GroupRow, GroupTable } from "@/lib/group-stage";

// Групповая стадия — макет как на Liquipedia: для каждой группы рядом две таблицы. Слева узкий
// рейтинг (место, лого, команда, В–П, очки), справа перекрёстная сетка личных встреч: ячейки залиты
// цветом (зелёная — победа команды-строки, красная — поражение), по краям лого команд, диагональ
// затемнена. Плотно, без пустых мест. Только чтение: счёт из привязанных карт архива серий,
// правки — через /admin/series.

const CARD = "overflow-hidden rounded-card bg-surface cushion-card";
// Та же карточка, но прокручиваемая: `overflow-hidden` из CARD перебивал `overflow-x-auto` (оба
// правила одной специфичности, порядок решает стилевой файл, а не класс), и на телефоне сетка
// личных встреч просто обрезалась — прокрутить её было нельзя.
const CARD_SCROLL = "rounded-card bg-surface cushion-card overflow-x-auto";

/** Заголовок-полоска над таблицей/сеткой — компактный uppercase в духе pouf Eyebrow. */
const HEAD = "px-4 py-2.5 text-center text-[11px] font-extrabold uppercase tracking-[1.5px] text-muted";

/** Лого команды. Нет файла — монограмма из первых букв тега на подложке. */
function TeamMark({ row, size = 26 }: { row: GroupRow; size?: number }) {
  return row.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={row.logo}
      alt=""
      title={row.name}
      className="shrink-0 rounded-md bg-surface-2 object-contain p-0.5"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      title={row.name}
      className="grid shrink-0 place-items-center rounded-md bg-surface-2 text-[10px] font-bold uppercase leading-none text-ink-muted"
      style={{ width: size, height: size }}
    >
      {row.tag.slice(0, 2)}
    </span>
  );
}

/** Рейтинг группы: место с полоской зоны, лого, команда, В–П и плашка очков. */
function StandingsCard({ t }: { t: GroupTable }) {
  return (
    <div className={`${CARD} w-full lg:w-[23rem] lg:shrink-0`}>
      <div className={`border-b border-hairline ${HEAD}`}>Таблица</div>
      <table className="w-full border-collapse text-sm">
        <tbody>
          {t.rows.map((r) => {
            const zone = QUALIFICATION[qualificationOf(r.place, t.rows.length, t.relegation)];
            const leader = r.place === 1;
            return (
              <tr key={r.teamId} className="group border-t border-hairline transition-colors hover:bg-surface-2/50">
                <td className="py-2.5 pl-3 pr-1">
                  <span className="flex items-center gap-2">
                    <span className={`h-5 w-1 rounded-full ${zone.marker}`} title={zone.label} />
                    <span className={`w-4 text-right tabular-nums ${leader ? "font-bold text-ink" : "text-ink-subtle"}`}>
                      {r.place}
                    </span>
                  </span>
                </td>
                <td className="py-2.5 pr-2">
                  <Link href={`/roster/teams/${r.teamId}`} className="flex min-w-0 items-center gap-2.5">
                    <TeamMark row={r} size={26} />
                    <span className={`truncate font-medium group-hover:underline ${zone.text}`} title={r.name}>
                      {r.name}
                    </span>
                  </Link>
                </td>
                <td className="w-12 py-2.5 text-center tabular-nums">
                  <span className="font-medium text-emerald-400/90">{r.wins}</span>
                  <span className="text-ink-subtle">–{r.losses}</span>
                </td>
                <td className="w-12 py-2.5 pr-3 text-center">
                  <span
                    className={`inline-block min-w-7 rounded-pill px-2.5 py-0.5 text-sm font-black tabular-nums ${
                      leader ? "bg-purple text-[var(--on-accent)]" : "bg-surface-2 text-ink"
                    }`}
                  >
                    {r.points}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Перекрёстная сетка: строка — команда, столбец — соперник, ячейка — счёт серии глазами строки. */
function HeadToHeadCard({ t }: { t: GroupTable }) {
  return (
    <div className={CARD_SCROLL}>
      <div className={`border-b border-hairline ${HEAD}`}>Личные встречи</div>
      <table className="border-collapse text-sm">
        <tbody>
          {t.rows.map((r, i) => (
            <tr key={r.teamId}>
              {/* левый столбец — лого команды-строки. Липкий: при прокрутке сетки вбок иначе
                  непонятно, чья это строка */}
              <td className="sticky left-0 z-10 w-9 border border-hairline/50 bg-surface px-2 py-2">
                <span className="flex justify-center">
                  <TeamMark row={r} size={24} />
                </span>
              </td>
              {t.grid[i].map((cell, j) => {
                if (i === j) {
                  // диагональ — сам с собой не играет
                  return <td key={t.rows[j].teamId} className="border border-hairline/50 bg-surface-3/40" />;
                }
                const win = cell?.score.startsWith("2");
                return (
                  <td
                    key={t.rows[j].teamId}
                    title={cell ? `${r.name} — ${t.rows[j].name}` : undefined}
                    className={`border border-hairline/50 px-2 py-2 text-center text-sm font-medium tabular-nums ${
                      cell == null
                        ? "text-ink-subtle/30"
                        : win
                          ? "bg-emerald-500/12 text-emerald-300"
                          : "bg-rose-500/12 text-rose-300"
                    } ${cell?.guessed ? "opacity-60" : ""}`}
                  >
                    {cell ? cell.score : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
          {/* нижний ряд — лого команд-столбцов */}
          <tr>
            <td className="border border-hairline/50 bg-surface-2/30" />
            {t.rows.map((r) => (
              <td key={r.teamId} className="border border-hairline/50 bg-surface-2/30 px-2 py-2">
                <span className="flex justify-center">
                  <TeamMark row={r} size={24} />
                </span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function GroupStage({ tables }: { tables: GroupTable[] }) {
  return (
    <div className="space-y-10 font-pouf">
      {tables.map((t) => (
        <section key={t.group}>
          <div className="mb-3 flex items-baseline gap-2.5">
            <h2 className="text-xl font-black tracking-[-0.3px] text-ink">Группа {t.group}</h2>
            <span className="text-xs font-bold text-muted">{t.rows.length} команд</span>
          </div>
          {/* stretch (по умолчанию) — обе карточки одной высоты; на широком экране заметный зазор */}
          <div className="flex flex-col gap-4 lg:flex-row lg:gap-8">
            <StandingsCard t={t} />
            <HeadToHeadCard t={t} />
          </div>
        </section>
      ))}
    </div>
  );
}
