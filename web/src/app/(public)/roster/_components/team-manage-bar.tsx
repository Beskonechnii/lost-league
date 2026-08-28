"use client";

import { useState } from "react";
import { archiveTeamAction, restoreTeamAction, purgeTeamAction, type ActionResult } from "./actions";

// Управление командой в общем пуле — виден только оператору с правом roster.delete (страница передаёт
// `manage`). Двухэтапное удаление (см. Team.archivedAt и lib/team-admin):
//   в пуле  → «Убрать из пула» = архив (обратимо, история турниров цела);
//   в архиве → «Вернуть в пул» и «Удалить полностью» (второе — физический снос со всей статистикой).
// Действия серверные (actions.ts): после успеха revalidatePath перерисовывает список и счётчики сам,
// поэтому router.refresh здесь не нужен. Подтверждение — нативным confirm: действие редкое и операторское.

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

  // Плейн-async, а не useTransition: оптимистичное скрытие карточки (onDone) — обычное, высокого
  // приоритета обновление, оно применяется сразу; в транзакции React откладывал его до простоя.
  const call = async (action: () => Promise<ActionResult>) => {
    setPending(true);
    const res = await action();
    setPending(false);
    if ("error" in res) alert(res.error);
    else onDone?.(teamId);
  };

  const archive = () => {
    if (!confirm(`Убрать «${teamName}» из общего пула? Она останется в таблицах и матчах своих турниров, но пропадёт из ростера. Вернуть можно из архива.`)) return;
    call(() => archiveTeamAction(teamId));
  };
  const restore = () => call(() => restoreTeamAction(teamId));
  const purge = () => {
    if (!confirm(`Удалить «${teamName}» ПОЛНОСТЬЮ и безвозвратно — вместе с составами, участием, сериями и матчами? Это нельзя отменить.`)) return;
    call(() => purgeTeamAction(teamId));
  };

  const btn =
    "rounded-[12px] px-3 py-1.5 text-xs font-black cushion-field transition disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-4 py-3">
      {archived ? (
        <>
          <button type="button" onClick={restore} disabled={pending} className={`${btn} bg-surface text-ink-muted hover:text-ink`}>
            Вернуть в пул
          </button>
          <button
            type="button"
            onClick={purge}
            disabled={pending}
            className={`${btn} bg-[color-mix(in_srgb,#ef4444_16%,transparent)] text-red-300 hover:text-red-200`}
          >
            Удалить полностью
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={archive}
          disabled={pending}
          className={`${btn} bg-surface text-ink-subtle hover:text-red-300`}
        >
          Убрать из пула
        </button>
      )}
    </div>
  );
}
