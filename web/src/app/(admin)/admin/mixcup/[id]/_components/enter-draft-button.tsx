"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/pouf/Button";

// Точка входа в сам борд: открывает (или заводит, если ещё нет) живую сессию события и уходит
// в неё — тот же приём, что NewDraftButton у UNDERBEER, только сессия привязывается к событию.

export function EnterDraftButton({ eventId, label }: { eventId: number; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function enter() {
    setBusy(true);
    try {
      const res = await fetch(`/api/mixcup/${eventId}/draft`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      router.push(`/admin/mixcup/${eventId}/draft`);
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
