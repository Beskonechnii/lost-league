"use client";

import { useState } from "react";
import { archiveTeamAction, restoreTeamAction, purgeTeamAction, type ActionResult } from "./actions";

// Управление командой в общем пуле — виден только оператору с правом roster.delete (страница передаёт
// `manage`). Двухэтапное удаление (см. Team.archivedAt и lib/team-admin):
//   в пуле  → «Убрать из пула» = архив (обратимо, история турниров цела);
//   в архиве → «Вернуть в пул» и «Удалить полностью» (второе — физический снос со всей статистикой).
// Действия серверные (actions.ts): после успеха revalidatePath перерисовывает список и счётчики сам,
// плюс onDone прячет карточку сразу.
//
// Подтверждение — ВСТРОЕННОЕ (кнопка → «Точно? Да / Отмена»), а не нативный confirm(): в песочном
// iframe (превью, встраивание) window.confirm молча возвращает false, диалога нет — и кнопка «не
// нажималась». Инлайн-подтверждение работает везде.

const btn = "rounded-[12px] px-3 py-1.5 text-xs font-black cushion-field transition disabled:opacity-50 disabled:cursor-not-allowed";

export function TeamManageBar({
  teamId,
  teamName,
  archived,
  onDone,
}: {
  teamId: number;
  teamName: string;
  archived: boolean;
  /** Убрать карточку из текущего разреза сразу после успеха — не дожидаясь серверной перерисовки:
   *  revalidatePath обновляет счётчики, но клиентский список (PoolExplorer) новые пропсы не подхватывал. */
  onDone?: (teamId: number) => void;
}) {
  const [pending, setPending] = useState(false);
  // Какое разрушительное действие ждёт подтверждения (архив/снос). Возврат из архива не разрушителен —
  // подтверждения не требует.
  const [confirming, setConfirming] = useState<null | "archive" | "purge">(null);

  const run = async (action: () => Promise<ActionResult>) => {
    setPending(true);
    const res = await action();
    setPending(false);
    setConfirming(null);
    if ("error" in res) alert(res.error);
    else onDone?.(teamId);
  };

  const restore = () => run(() => restoreTeamAction(teamId));

  // Экран подтверждения: заменяет обычные кнопки, пока ждём «Да / Отмена».
  if (confirming) {
    const label = confirming === "archive" ? `Убрать «${teamName}» из пула?` : `Удалить «${teamName}» полностью?`;
    const doIt = () =>
      run(() => (confirming === "archive" ? archiveTeamAction(teamId) : purgeTeamAction(teamId)));
    return (
      <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-4 py-3">
        <span className="mr-1 text-xs font-bold text-ink-muted">{label}</span>
        <button
          type="button"
          onClick={doIt}
          disabled={pending}
          className={`${btn} ${confirming === "purge" ? "bg-[color-mix(in_srgb,#ef4444_22%,transparent)] text-red-200" : "bg-purple text-[var(--on-accent)] cushion-control"}`}
        >
          {pending ? "…" : confirming === "purge" ? "Удалить навсегда" : "Да, убрать"}
        </button>
        <button type="button" onClick={() => setConfirming(null)} disabled={pending} className={`${btn} bg-surface text-ink-muted hover:text-ink`}>
          Отмена
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-4 py-3">
      {archived ? (
        <>
          <button type="button" onClick={restore} disabled={pending} className={`${btn} bg-surface text-ink-muted hover:text-ink`}>
            Вернуть в пул
          </button>
          <button
            type="button"
            onClick={() => setConfirming("purge")}
            disabled={pending}
            className={`${btn} bg-[color-mix(in_srgb,#ef4444_16%,transparent)] text-red-300 hover:text-red-200`}
          >
            Удалить полностью
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming("archive")}
          disabled={pending}
          className={`${btn} bg-surface text-ink-subtle hover:text-red-300`}
        >
          Убрать из пула
        </button>
      )}
    </div>
  );
}
