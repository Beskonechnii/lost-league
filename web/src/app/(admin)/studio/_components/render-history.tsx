"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/pouf/alert-dialog";

// История генераций с удалением. Клиент — удаление это DELETE (запись); строки убираем
// оптимистично, чтобы не перезапрашивать страницу. Подтверждение — Radix AlertDialog, а не
// window.confirm(): нативный диалог подавляется в webview и кнопка «молча не работала».

type Item = { id: number; templateId: string; title: string | null; created: string };

export function RenderHistory({ renders }: { renders: Item[] }) {
  const [items, setItems] = useState(renders);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const pending = items.find((r) => r.id === confirmId);

  async function remove(id: number) {
    setBusy(id);
    try {
      const res = await fetch(`/api/studio/renders/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setItems((x) => x.filter((r) => r.id !== id));
    } catch (e) {
      toast.error(`Не удалось удалить: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(null);
      setConfirmId(null);
    }
  }

  if (items.length === 0) return null;

  return (
    <section className="font-pouf">
      <h2 className="mb-3 text-[13px] font-extrabold uppercase tracking-[1.5px] text-muted">История</h2>
      <ul className="space-y-2 text-sm">
        {items.map((r) => {
          const label = r.title ?? r.templateId;
          return (
            <li key={r.id} className="flex items-center gap-2">
              <Link href={`/studio/new/${r.templateId}?render=${r.id}`} className="font-bold text-[var(--accent-ink)] hover:underline">
                {label}
              </Link>
              <span className="text-xs font-bold text-muted">{r.created}</span>
              <button
                onClick={() => setConfirmId(r.id)}
                title="Удалить из истории"
                className="ml-1 rounded p-0.5 text-xs text-ink-subtle transition-colors hover:text-red-700"
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>

      <AlertDialog open={confirmId !== null} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить из истории?</AlertDialogTitle>
            <AlertDialogDescription>
              «{pending?.title ?? pending?.templateId}» будет убран из истории генераций.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy !== null}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              // preventDefault: remove() снимет confirmId сам в finally, показав «…» на время запроса.
              onClick={(e) => {
                e.preventDefault();
                if (confirmId !== null) remove(confirmId);
              }}
              disabled={busy !== null}
              tone="down"
            >
              {busy !== null ? "…" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
