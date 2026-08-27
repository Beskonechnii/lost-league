"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Управление командой в общем пуле — виден только оператору с правом roster.delete (страница
// передаёт `manage`). Двухэтапное удаление (см. Team.archivedAt и API /api/roster/teams/[id]):
//   в пуле  → «Убрать из пула» = архив (обратимо, история турниров цела);
//   в архиве → «Вернуть в пул» и «Удалить полностью» (второе — физический снос со всей статистикой).
// Подтверждение — нативным confirm: действие редкое и операторское, свой модал тут лишний.

async function call(url: string, method: "POST" | "DELETE"): Promise<string | null> {
  try {
    const res = await fetch(url, { method });
    if (res.ok) return null;
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    return body?.error ?? `Ошибка ${res.status}`;
  } catch {
    return "Сеть недоступна";
  }
}

export function TeamManageBar({ teamId, teamName, archived }: { teamId: number; teamName: string; archived: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const working = pending || busy;

  const run = (url: string, method: "POST" | "DELETE") => {
    setBusy(true);
    call(url, method).then((err) => {
      setBusy(false);
      if (err) {
        alert(err);
        return;
      }
      start(() => router.refresh());
    });
  };

  const archive = () => {
    if (!confirm(`Убрать «${teamName}» из общего пула? Она останется в таблицах и матчах своих турниров, но пропадёт из ростера. Вернуть можно из архива.`)) return;
    run(`/api/roster/teams/${teamId}?mode=archive`, "DELETE");
  };
  const restore = () => run(`/api/roster/teams/${teamId}/restore`, "POST");
  const purge = () => {
    if (!confirm(`Удалить «${teamName}» ПОЛНОСТЬЮ и безвозвратно — вместе с составами, участием, сериями и матчами? Это нельзя отменить.`)) return;
    run(`/api/roster/teams/${teamId}?mode=purge`, "DELETE");
  };

  const btn =
    "rounded-[12px] px-3 py-1.5 text-xs font-black cushion-field transition disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-4 py-3">
      {archived ? (
        <>
          <button type="button" onClick={restore} disabled={working} className={`${btn} bg-surface text-ink-muted hover:text-ink`}>
            Вернуть в пул
          </button>
          <button
            type="button"
            onClick={purge}
            disabled={working}
            className={`${btn} bg-[color-mix(in_srgb,#ef4444_16%,transparent)] text-red-300 hover:text-red-200`}
          >
            Удалить полностью
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={archive}
          disabled={working}
          className={`${btn} bg-surface text-ink-subtle hover:text-red-300`}
        >
          Убрать из пула
        </button>
      )}
    </div>
  );
}
