import { shardsOfAccount } from "@/lib/shards";
import { shardReasonLabel } from "@/lib/shard-grades";
import { Eyebrow } from "@/components/pouf/text";
import { ShardAmount, ShardBar, ShardGradeBadge, ShardLadder } from "@/components/pouf/shards";

// Осколки на витрине — своё, а не общее: сколько человек заработал, на какой он ступени и что
// сделать, чтобы стало больше. Стоит рядом с зачётом TP намеренно — две валюты у лиги разные, и
// увидеть разницу проще всего, когда они стоят в одной строке: слева чужие места за игру, справа
// своё за участие.
//
// Гостю блока нет вовсе: осколки — свойство аккаунта, показывать «0 у неизвестно кого» незачем.
// ТРАТ здесь нет и быть не должно (Э22): витрина показывает заработанное, магазин — отдельная
// задача, которую ещё не ставили.

const day = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long" });

export async function ShardsBlock({ accountId }: { accountId: number }) {
  const { earned, entries, progress, todo } = await shardsOfAccount(accountId);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Eyebrow>Осколки</Eyebrow>
        <ShardGradeBadge earned={earned} />
      </div>

      <div className="space-y-4 rounded-card bg-surface p-4 cushion-card">
        <div className="flex items-end justify-between gap-3">
          <ShardAmount amount={earned} earned={earned} size="lg" />
          <span className="text-[11px] font-extrabold uppercase tracking-[1px] text-muted">
            заработано за всё время
          </span>
        </div>

        <ShardBar earned={earned} />
        <ShardLadder earned={earned} />

        {entries.length > 0 && (
          <ul className="space-y-1 border-t border-hairline pt-3">
            {entries.slice(0, 4).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 text-[13px] font-bold">
                <span className="min-w-0 truncate text-ink">{e.note ?? shardReasonLabel(e.reason)}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-[11px] font-extrabold text-ink-subtle">{day.format(e.createdAt)}</span>
                  <ShardAmount amount={e.amount} earned={earned} sign />
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Что ещё можно взять — по одной невзятой вехе за раз: список из четырёх «сделайте это»
            читается как претензия, а первая строка — как подсказка. */}
        {todo.length > 0 && (
          <div className="rounded-control bg-surface-2 px-3 py-2.5 text-[13px] font-bold text-ink-muted cushion-field">
            {todo[0].hint}
            <span className="ml-1 whitespace-nowrap font-black text-ink">+{todo[0].amount}</span>
            {todo.length > 1 && (
              <span className="ml-1 text-[12px] font-extrabold text-muted">
                и ещё {todo.length - 1} {todo.length - 1 === 1 ? "веха" : "вехи"}
              </span>
            )}
          </div>
        )}

        {earned === 0 && (
          <p className="text-[13px] font-bold text-muted">
            Осколки начисляются после того, как организатор одобрит заявку, — и дальше за то, что вы
            делаете в лиге. Потратить их пока некуда: это счёт участия, а не кошелёк.
          </p>
        )}

        {progress.next === null && (
          <p className="text-[13px] font-bold text-muted">Верхняя ступень взята — выше в лиге пока никого.</p>
        )}
      </div>
    </section>
  );
}
