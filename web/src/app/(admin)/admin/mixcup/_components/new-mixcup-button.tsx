"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/pouf/Button";

// Короткий путь к турниру формата Mix Cup: заводит пустой и уходит в него — тот же приём, что
// у NewDraftButton в UNDERBEER. Название и слаг заводятся сервером («Mix Cup #<id>», пока
// оператор не переименовал); слаг ставится один раз (конвенция проекта), поэтому спрашивать его
// при создании незачем. Полный путь с выбором формата — мастер /admin/tournaments/new.

export function NewMixCupButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "mixcup" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const tournament = (await res.json()) as { slug: string };
      router.push(`/admin/tournaments/${tournament.slug}`);
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
