"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { IconButton } from "@/components/pouf/Button";
import { Icon } from "@/components/pouf/Icon";
import { EmptyState, StatusPill } from "@/components/pouf/feedback";
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

// Список драфтов с удалением. Клиент, потому что удаление — это DELETE (запись); карточки
// убираем оптимистично из локального состояния, чтобы не перезапрашивать всю страницу.
//
// Подтверждение — Radix AlertDialog, а не window.confirm(): нативный диалог подавляется
// в webview (например, в панели предпросмотра), и кнопка «молча не работала». Плюс фокус-ловушка,
// Esc и имя драфта в заголовке — единый язык с модалкой архива серий.

type Item = { id: number; title: string | null; status: string; updated: string };

export function DraftList({ sessions }: { sessions: Item[] }) {
  const [items, setItems] = useState(sessions);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const pending = items.find((s) => s.id === confirmId);

  async function remove(id: number) {
    setBusy(id);
    try {
      const res = await fetch(`/api/underbeer/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setItems((x) => x.filter((s) => s.id !== id));
    } catch (e) {
      toast.error(`Не удалось удалить: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(null);
      setConfirmId(null);
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState icon="users" title="Драфтов пока нет">
        Нажмите «Новый драфт», чтобы собрать шоу-команды из живого ростера.
      </EmptyState>
    );
  }

  return (
    <ul className="grid gap-3 font-pouf sm:grid-cols-2 lg:grid-cols-3">
      {items.map((s) => {
        const label = s.title ?? `Драфт #${s.id}`;
        return (
          <li key={s.id} className="group relative">
            <Link
              href={`/underbeer/${s.id}`}
              className="block rounded-card bg-surface p-4 cushion-card transition-transform duration-200 hover:-translate-y-1"
            >
              <div className="flex items-center justify-between gap-2 pr-12">
                <span className="truncate font-black text-ink">{label}</span>
                <StatusPill tone={s.status === "done" ? "ok" : "warn"}>
                  {s.status === "done" ? "Собран" : "Черновик"}
                </StatusPill>
              </div>
              <div className="mt-2 text-xs font-bold text-muted">Обновлён {s.updated}</div>
            </Link>

            {/* Удаление — кнопка поверх карточки, отдельно от ссылки (кнопку в ссылку вкладывать нельзя).
                Само подтверждение — один AlertDialog на список, ниже; сюда кладём только его триггер. */}
            <div className="absolute right-2 top-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <IconButton
                icon={<Icon name="remove" size="sm" />}
                label="Удалить драфт"
                tone="down"
                size="xs"
                onClick={() => setConfirmId(s.id)}
              />
            </div>
          </li>
        );
      })}

      <AlertDialog open={confirmId !== null} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить драфт?</AlertDialogTitle>
            <AlertDialogDescription>
              «{pending?.title ?? `Драфт #${pending?.id}`}» будет удалён без возможности восстановления.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy !== null}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              // preventDefault: не закрываем сразу — remove() снимет confirmId сам в finally, показав «…».
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
    </ul>
  );
}
