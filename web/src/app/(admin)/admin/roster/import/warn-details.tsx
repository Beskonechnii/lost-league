import type { ReactNode } from "react";

/**
 * Свёрнутый список замечаний на предупреждающей коже. Не `Alert`: у алерта нет
 * содержимого, которое раскрывают, а тут под заголовком лежит список из
 * полусотни строк — развёрнутым он топит собой весь экран.
 *
 * Отдельным файлом с Э11: до слияния экранов эти двадцать строк были скопированы
 * в обе формы импорта. В Кит атом поедет с третьим потребителем — пока их два,
 * и оба лежат в одной папке.
 */
export function WarnDetails({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  return (
    <details
      className="rounded-chip px-(--s4) pb-[calc(var(--s3)+var(--lip)/2)] pt-[calc(var(--s3)-var(--lip)/2)] font-pouf cushion-alert"
      style={{ backgroundImage: "var(--grad-warn)" }}
    >
      <summary className="cursor-pointer text-[13px] font-extrabold text-[var(--color-warn-ink)]">
        {summary}
      </summary>
      <div className="mt-2 max-h-52 overflow-y-auto">{children}</div>
    </details>
  );
}
