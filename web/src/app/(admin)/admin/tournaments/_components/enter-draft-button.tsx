"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/pouf/Button";

// Точка входа в сам борд: открывает (или заводит, если ещё нет) живую сессию турнира и уходит
// в неё — тот же приём, что NewDraftButton у ad hoc-UNDERBEER, только сессия привязана к турниру.

export function EnterDraftButton({ tournamentId, slug, label }: { tournamentId: number; slug: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function enter() {
    setBusy(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/draft`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      router.push(`/admin/tournaments/${slug}/draft`);
    } catch (e) {
      toast.error(`Не удалось открыть драфт: ${e instanceof Error ? e.message : e}`);
      setBusy(false);
    }
  }

  return (
    <Button onClick={enter} loading={busy} tone="orange">
      {label}
    </Button>
  );
}
