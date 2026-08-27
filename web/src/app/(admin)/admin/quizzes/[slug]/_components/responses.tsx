"use client";

// Ответы таблицей: колонки — вопросы, строки — люди. Таблица шире экрана — прокручивается в своём
// контейнере, а не тянет страницу (UI-GUIDELINES).

const dateTime = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

type Table = {
  columns: string[];
  rows: { username: string | null; createdAt: Date; cells: string[]; extra: { question: string; answer: string }[] }[];
};

export function Responses({ slug, table }: { slug: string; table: Table }) {
  if (table.rows.length === 0) {
    return (
      <p className="mt-3 rounded-md border border-hairline bg-surface-1 px-3 py-6 text-center text-sm text-ink-subtle">
        Ответов пока нет.
      </p>
    );
  }

  return (
    <>
      <div className="mt-3 flex justify-end">
        <a
          href={`/api/quizzes/${slug}/export`}
          className="rounded-md border border-hairline px-3 py-1 text-xs text-ink hover:border-accent-bright"
        >
          Скачать CSV
        </a>
      </div>

      <div className="mt-2 overflow-x-auto rounded-lg border border-hairline bg-surface-1">
        <table className="w-full min-w-max text-left text-xs">
          <thead className="border-b border-hairline text-ink-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Кто</th>
              <th className="px-3 py-2 font-medium">Когда</th>
              {table.columns.map((c) => (
                <th key={c} className="px-3 py-2 font-medium">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i} className="border-b border-hairline/50 last:border-0">
                <td className="whitespace-nowrap px-3 py-2 text-ink">{row.username ? `@${row.username}` : "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-ink-subtle">{dateTime.format(new Date(row.createdAt))}</td>
                {row.cells.map((cell, j) => (
                  <td key={j} className="max-w-xs px-3 py-2 text-ink-muted">
                    {cell || "—"}
                    {/* Ответы на удалённые вопросы показываем здесь же, у последней колонки:
                        иначе они пропали бы молча вместе с вопросом. */}
                    {j === row.cells.length - 1 &&
                      row.extra.map((e) => (
                        <div key={e.question} className="mt-1 text-ink-subtle">
                          <span className="text-ink-subtle/70">{e.question}:</span> {e.answer}
                        </div>
                      ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
