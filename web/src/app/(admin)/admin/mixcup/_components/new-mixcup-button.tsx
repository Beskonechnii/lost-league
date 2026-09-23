"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/pouf/Button";

// Завести пустое событие и уйти в него — тот же приём, что у NewDraftButton в UNDERBEER.
// Название и слаг заводятся сервером («Mix Cup #<id>» пока оператор не переименовал); слаг
// ставится один раз (конвенция проекта), поэтому спрашивать его при создании незачем.

export function NewMixCupButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const res = await fetch("/api/mixcup", { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const event = (await res.json()) as { id: number };
      router.push(`/admin/mixcup/${event.id}`);
    } catch (e) {
      toast.error(`Не удалось создать Mix Cup: ${e instanceof Error ? e.message : e}`);
      setBusy(false);
    }
  }

  return (
    <Button onClick={create} loading={busy} tone="orange">
      Новый Mix Cup
    </Button>
  );
}
