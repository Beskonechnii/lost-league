"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TrashIcon } from "lucide-react";
import { Button, IconButton } from "@/components/pouf/Button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/pouf/alert-dialog";

// Удаление документа редактора. Подтверждение — Radix AlertDialog, а не window.confirm():
// нативный диалог подавляется в webview и кнопка «молча не работала» (тот же приём, что в
// render-history.tsx). На карточке списка — иконка (refresh), в шапке редактора — с подписью и
// уходом назад (redirectTo → push).

export function DeleteDesign({
  id,
  title,
  redirectTo,
  full = false,
}: {
  id: number;
  title?: string | null;
  redirectTo?: string;
  full?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/studio/designs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } catch (e) {
      toast.error(`Не удалось удалить: ${e instanceof Error ? e.message : e}`);
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {full ? (
          <Button type="button" variant="quiet" tone="down" size="sm">
            <TrashIcon size={16} />
            Удалить
          </Button>
        ) : (
          <IconButton
            type="button"
            variant="quiet"
            tone="down"
            size="sm"
            label="Удалить документ"
            icon={<TrashIcon size={16} />}
          />
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить документ?</AlertDialogTitle>
          <AlertDialogDescription>
            {title ? `«${title}»` : "Документ"} будет удалён без возможности восстановления.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Отмена</AlertDialogCancel>
          <AlertDialogAction
            // preventDefault: remove() сам закрывает диалог (или показывает «…» на время запроса)
            onClick={(e) => {
              e.preventDefault();
              void remove();
            }}
            disabled={busy}
            tone="down"
          >
            {busy ? "…" : "Удалить"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
