"use client";

import { useState } from "react";
import { Button } from "@/components/pouf/Button";
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

// Удаление чужого аккаунта входа — только владелец лиги (см. deleteAccount в lib/account.ts).
// Подтверждение — Radix AlertDialog, не window.confirm() (та же причина, что в delete-tournament:
// нативный диалог подавляется в webview).

export function DeleteAccount({
  id,
  who,
  action,
}: {
  id: number;
  who: string;
  action: (form: FormData) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" size="sm" variant="quiet">
          Удалить аккаунт
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить аккаунт «{who}»?</AlertDialogTitle>
          <AlertDialogDescription>
            Пропадёт вход: пароль, привязка Google/Telegram, роль и права. Профиль игрока в ростере
            и его турнирная история останутся — привязка к аккаунту просто рвётся. Восстановить нельзя.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={action} onSubmit={() => setBusy(true)}>
          <input type="hidden" name="accountId" value={id} />
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={busy}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction type="submit" disabled={busy} tone="down">
              {busy ? "…" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
