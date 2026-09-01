"use client";

import { useRouter } from "next/navigation";
import { MatchArchive, useArchive } from "@/app/_components/match-archive";

// Полка выгруженных картинок — операторский инструмент, поэтому страница подключает её
// только вошедшему. Здесь — обвязка: загрузка полки и переход в отчёт по клику.

export function ArchiveShelf() {
  const router = useRouter();
  const { items, reload } = useArchive();

  return (
    <MatchArchive
      items={items}
      onOpen={(e) => router.push(e.source === "steam" ? `/match/${e.matchId}?src=steam` : `/match/${e.matchId}`)}
      onChanged={reload}
    />
  );
}
