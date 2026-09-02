"use client";

import { Alert } from "@/components/pouf/feedback";
import type { FlowIssue } from "@/lib/bot-flow/validate";
import type { NodeId } from "@/lib/bot-flow/types";

/* Список претензий валидатора (`bot-flow/validate.ts`, Э3).
 *
 * Строка кликабельна и выделяет ноду: претензия без «где» бесполезна на графе из двух десятков
 * карточек, а искать по id глазами — работа, которую должен делать экран.
 *
 * Ошибки не пускают граф в эфир, предупреждения пускают: пустой выход сегодня значит «дальше
 * разбирается старый обработчик», и до Э6 это норма, а не дыра.
 */

export function FlowCheck({ issues, onSelect }: { issues: FlowIssue[]; onSelect: (id: NodeId) => void }) {
  if (!issues.length) {
    return (
      <Alert tone="ok" block>
        Проверка пройдена: у каждой ноды есть вход и выход, недостижимых нод и петель нет.
      </Alert>
    );
  }

  return (
    <ul className="space-y-1.5">
      {issues.map((issue, i) => {
        const line = (
          <>
            <span
              className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-pill text-[10px] font-black"
              style={{
                backgroundImage: issue.level === "error" ? "var(--grad-err)" : "var(--grad-warn)",
                color: issue.level === "error" ? "var(--color-err-ink)" : "var(--color-warn-ink)",
              }}
            >
              !
            </span>
            <span className="min-w-0 text-xs font-bold leading-[1.5] text-ink">
              {issue.node && <code className="mr-1 font-black text-muted">{issue.node}</code>}
              {issue.text}
            </span>
          </>
        );
        return (
          <li key={`${issue.node ?? "graph"}:${issue.port ?? ""}:${i}`}>
            {issue.node ? (
              <button
                type="button"
                onClick={() => onSelect(issue.node as NodeId)}
                className="flex w-full items-start gap-2 rounded-control border-none bg-surface-2 p-2 text-left cushion-field"
              >
                {line}
              </button>
            ) : (
              <div className="flex items-start gap-2 rounded-control bg-surface-2 p-2 cushion-field">{line}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
