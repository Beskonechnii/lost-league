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

// Удаление турнира. Подтверждение — Radix AlertDialog, а не window.confirm(): нативный диалог
// подавляется в webview и кнопка «молча не работала» (та же причина, что в studio/delete-design).
// В диалоге перечислено, что именно уедет: турнир — контейнер сезона, и удаление сносит его архив.

export type TournamentUsage = {
  divisions: number;
  entries: number;
  series: number;
  games: number;
  spots: number;
  applications: number;
  points: number;
};

/** «5 команд» — счётчик показываем, только если он не ноль: пустой список пунктов честнее нулей. */
const lines = (u: TournamentUsage): string[] =>
  [
    [u.divisions, "дивизион(ов)"],
    [u.entries, "участие команд"],
    [u.spots, "мест в составах сезона"],
    [u.series, "встреч"],
    [u.games, "карт"],
    [u.applications, "заявок"],
    [u.points, "начислений TP"],
  ]
    .filter(([n]) => (n as number) > 0)
    .map(([n, label]) => `${n} ${label}`);

export function DeleteTournament({
  id,
  name,
  usage,
  action,
}: {
  id: number;
  name: string;
  usage: TournamentUsage;
  action: (form: FormData) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const items = lines(usage);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" size="sm" variant="quiet">
          Удалить турнир
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить «{name}»?</AlertDialogTitle>
          <AlertDialogDescription>
            {items.length ? `Вместе с турниром уедут: ${items.join(", ")}. ` : "Турнир пустой. "}
            Команды и игроки останутся в ростере — уходит только их участие. Восстановить нельзя.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={action} onSubmit={() => setBusy(true)}>
          <input type="hidden" name="id" value={id} />
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
