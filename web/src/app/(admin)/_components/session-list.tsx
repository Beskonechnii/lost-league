"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { IconButton } from "@/components/pouf/Button";
import { Icon, type IconName } from "@/components/pouf/Icon";
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

/* Список сессий эфемерного инструмента: карточка со статусом, датой и удалением.
 *
 * Заведён на Э11b, потому что этот экран написан дважды — архив UNDERBEER и архив
 * fearless-драфта. Оба списка отвечают на один вопрос («какие сессии есть и какую
 * открыть») и оба удаляют строку одним DELETE; расходились они только словами
 * («Собран» против «готов») и тем, что вторая копия ещё не доехала до Кита: там
 * статус был свёрстан руками пилюлей `bg-ok`, а пустого состояния не было вовсе —
 * пустой архив показывал одну серую фразу.
 *
 * Живёт в `(admin)/_components`, а не в `pouf/`: он знает про понятие «сессия
 * инструмента» и про то, что её удаляют запросом, — это служебная часть, а не Кит.
 *
 * Клиент, потому что удаление это запись: карточку убираем из локального состояния,
 * не перезапрашивая весь список. Подтверждение — Radix AlertDialog, а не
 * `window.confirm()`: нативный диалог подавляется в webview (например, в панели
 * предпросмотра), и кнопка «молча не работала».
 */

export type ToolSession = {
  id: number;
  /** Уже готовое имя: подстановку «Драфт #12» делает страница, она знает своё слово. */
  title: string;
  updated: string;
  done: boolean;
};

export function SessionList({
  items: initial,
  hrefBase,
  apiBase,
  doneLabel = "Готов",
  draftLabel = "Черновик",
  emptyIcon = "sword",
  emptyTitle,
  emptyHint,
  removeLabel = "Удалить драфт",
}: {
  items: ToolSession[];
  /** Куда ведёт карточка, без id: `/underbeer`, `/admin/fearless-draft`. Строкой, а не
   *  функцией: список — клиентский компонент, а функцию через границу сервера не передать. */
  hrefBase: string;
  /** Что удаляет крестик, без id: `/api/underbeer`. */
  apiBase: string;
  doneLabel?: string;
  draftLabel?: string;
  emptyIcon?: IconName;
  emptyTitle: string;
  /** Почему пусто и что с этим делать — пустой экран без объяснения читается как поломка. */
  emptyHint: string;
  removeLabel?: string;
}) {
  const [items, setItems] = useState(initial);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const pending = items.find((s) => s.id === confirmId);

  async function remove(id: number) {
    setBusy(id);
    try {
      const res = await fetch(`${apiBase}/${id}`, { method: "DELETE" });
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
      <EmptyState icon={emptyIcon} title={emptyTitle}>
        {emptyHint}
      </EmptyState>
    );
  }

  return (
    <ul className="grid gap-3 font-pouf sm:grid-cols-2 lg:grid-cols-3">
      {items.map((s) => (
        <li key={s.id} className="group relative">
          <Link
            href={`${hrefBase}/${s.id}`}
            className="block rounded-card bg-surface p-4 cushion-card transition-transform duration-200 hover:-translate-y-1"
          >
            <div className="flex items-center justify-between gap-2 pr-12">
              <span className="truncate font-black text-ink">{s.title}</span>
              <StatusPill tone={s.done ? "ok" : "warn"}>{s.done ? doneLabel : draftLabel}</StatusPill>
            </div>
            <div className="mt-2 text-xs font-bold text-muted">Обновлён {s.updated}</div>
          </Link>

          {/* Удаление — кнопка поверх ссылки, отдельно от неё (кнопку в ссылку вкладывать нельзя).
              Само подтверждение — один AlertDialog на список, ниже; сюда кладём только его триггер. */}
          <div className="absolute right-2 top-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-lg:opacity-100">
            <IconButton
              icon={<Icon name="remove" size="sm" />}
              label={removeLabel}
              tone="down"
              size="xs"
              onClick={() => setConfirmId(s.id)}
            />
          </div>
        </li>
      ))}

      <AlertDialog open={confirmId !== null} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{removeLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              «{pending?.title}» будет удалён без возможности восстановления.
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
