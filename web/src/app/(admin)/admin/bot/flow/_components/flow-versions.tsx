"use client";

import { Button } from "@/components/pouf/Button";
import { StatusPill } from "@/components/pouf/feedback";
import type { FlowVersion } from "@/lib/bot-flow/store";

/* Версии графа: что в эфире, что в столе, что было раньше.
 *
 * Версии не удаляются — сессия доигрывает на той, на которой начала (`BotSession.flowVersion`),
 * и снос строки оборвал бы разговор посреди анкеты. Поэтому здесь нет «удалить»: только «в эфир»
 * (откат) и «в черновик» (править от неё).
 */

const STATUS: Record<string, { label: string; tone: "ok" | "info" | "neutral" }> = {
  published: { label: "в эфире", tone: "ok" },
  draft: { label: "черновик", tone: "info" },
  archived: { label: "архив", tone: "neutral" },
};

const when = (d: Date | null) =>
  d ? new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

export function FlowVersions({
  versions,
  busy,
  onRollback,
  onEdit,
}: {
  versions: FlowVersion[];
  busy: boolean;
  onRollback: (id: number) => void;
  onEdit: (id: number) => void;
}) {
  if (!versions.length) {
    return (
      <p className="text-xs font-bold leading-[1.5] text-muted">
        Сохранённых версий пока нет: бот говорит дефолтным графом из кода. Первое сохранение заведёт версию 1.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {versions.map((v) => {
        const s = STATUS[v.status] ?? { label: v.status, tone: "neutral" as const };
        const live = v.status === "published";
        return (
          <li key={v.id} className="rounded-control bg-surface-2 p-2 font-pouf cushion-field">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-black text-ink">v{v.version}</span>
              <StatusPill tone={s.tone}>{s.label}</StatusPill>
              <span className="ml-auto text-[11px] font-bold text-muted">{when(v.publishedAt ?? v.updatedAt)}</span>
            </div>
            {v.note && <p className="mt-1 truncate text-[11px] font-bold text-muted">{v.note}</p>}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {!live && (
                <Button size="xs" variant="quiet" disabled={busy} onClick={() => onRollback(v.id)}>
                  В эфир
                </Button>
              )}
              <Button size="xs" variant="quiet" disabled={busy} onClick={() => onEdit(v.id)}>
                В черновик
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
