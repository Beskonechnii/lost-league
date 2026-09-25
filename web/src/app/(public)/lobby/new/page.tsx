import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canCreateLobby } from "@/lib/lobby";
import { DEFAULT_MAIN_SEC, DEFAULT_RESERVE_SEC } from "@/lib/fearless";
import { SectionHeader } from "@/components/pouf/blocks";
import { NewLobbyForm } from "../_components/new-lobby-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Собрать лобби" };

// Экран сбора комнаты. С 42б заводит её только админ с правом `tools`: комната с паролем —
// инструмент организатора встречи. Кто не может — 404: раздел закрытый, о его существовании
// сообщать нечего.

export default async function NewLobbyPage() {
  if (!(await canCreateLobby())) notFound();

  // Привязка к встрече необязательна (решение 13) — поле можно оставить пустым.
  const series = await prisma.series.findMany({
    orderBy: { id: "desc" },
    take: 50,
    select: { id: true, division: true, home: { select: { name: true } }, away: { select: { name: true } } },
  });

  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader eyebrow="Лига · комната встречи" title="Собрать лобби" />
      <NewLobbyForm
        series={series.map((s) => ({ id: s.id, label: `${s.home.name} — ${s.away.name} · ${s.division}` }))}
        defaults={{ mainSec: DEFAULT_MAIN_SEC, reserveSec: DEFAULT_RESERVE_SEC }}
      />
    </div>
  );
}
