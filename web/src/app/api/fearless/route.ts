import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/api-guard";

// Сессии fearless-драфта. Право tools — то же, что открывает страницы драфта: сессия эфемерная,
// в данные лиги не попадает.
// Пустой payload у новой сессии = борд стартует с экрана настройки (см. fearless-board.tsx).

// Чтение закрыто тем же правом `tools`, что и запись (ТЗ 22в §7): список сессий драфта — это
// названия чужих встреч, а сам борд — состояние идущего драфта. Потребители обоих GET'ов — только
// экраны `/admin/fearless-draft/*`, которые и так за этим правом; ОБС-вид лобби читает лобби, а не
// `FearlessSession`, и гейт его не касается.
export async function GET() {
  const denied = await guard("tools");
  if (denied) return denied;
  const sessions = await prisma.fearlessSession.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, status: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json(sessions);
}

export async function POST(req: Request) {
  const denied = await guard("tools");
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { title?: string };
  const saved = await prisma.fearlessSession.create({
    data: { title: body.title?.trim() || null, payload: "" },
  });
  return NextResponse.json(saved, { status: 201 });
}
