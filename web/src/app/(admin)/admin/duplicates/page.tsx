import { findDuplicates, mergeImpact } from "@/lib/duplicates";
import { denyUnlessPermission } from "../../_components/permission-gate";
import { READ_MAX_W } from "@/components/pouf/blocks";
import { DuplicateRow } from "./_components/duplicate-row";

export const metadata = { title: "Дубли профилей" };
export const dynamic = "force-dynamic";

// Очередь похожих профилей — устроена как очередь заявок: оператор видит пару и решает сам.
// Почему не автоматика — в шапке `src/lib/duplicates.ts`.

export default async function DuplicatesPage() {
  const denied = await denyUnlessPermission("roster.edit", "Дубли профилей");
  if (denied) return denied;

  const pairs = await findDuplicates();
  // Последствия считаем на сервере: «что переедет» должно быть видно до нажатия, а не после.
  const rows = await Promise.all(
    pairs.map(async (pair) => ({
      pair,
      intoA: await mergeImpact(pair.a.id, pair.b.id),
      intoB: await mergeImpact(pair.b.id, pair.a.id),
    })),
  );

  return (
    <main className={`mx-auto w-full ${READ_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <h1 className="text-xl font-bold tracking-tight">Дубли профилей</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Один человек попадает в ростер дважды, когда меняет ник между сезонами: импорт таблицы узнаёт
        его по нику, а не по account_id. Здесь решается, что с такой парой делать. Объединение
        необратимо — профиль-донор удаляется, а его места, статистика и баллы переезжают.
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-md border border-hairline bg-surface-1 px-3 py-6 text-center text-sm text-ink-subtle">
          Похожих профилей нет.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map(({ pair, intoA, intoB }) => (
            <DuplicateRow key={`${pair.a.id}:${pair.b.id}`} pair={pair} intoA={intoA} intoB={intoB} />
          ))}
        </ul>
      )}
    </main>
  );
}
