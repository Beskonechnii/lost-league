import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bad, parseId } from "@/lib/api";
import { FEARLESS_VERSION, type FearlessState } from "@/lib/fearless";
import { guard } from "@/lib/api-guard";

// Одна сессия fearless: чтение, автосейв payload по каждому ходу, удаление. Правила живут на клиенте
// (src/lib/fearless.ts) — сюда прилетает готовое состояние; сервер проверяет версию и валидность.

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");
  const session = await prisma.fearlessSession.findUnique({ where: { id } });
  if (!session) return bad("Сессия не найдена", 404);
  return NextResponse.json(session);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard("tools");
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");
  const body = (await req.json()) as { payload?: FearlessState | null; title?: string; status?: string };

  const data: { payload?: string; title?: string | null; status?: string } = {};
  if (body.payload === null) {
    // Сброс борда: пустой payload = сессия снова открывается экраном настройки. Без этой ветки
    // кнопка «Сбросить» очищала только экран, а перезагрузка возвращала брошенный драфт.
    data.payload = "";
    data.status = "draft";
  } else if (body.payload !== undefined) {
    if (body.payload?.version !== FEARLESS_VERSION) return bad("Несовместимая версия состояния драфта");
    data.payload = JSON.stringify(body.payload);
    // Серия «готова», когда доиграна последняя карта bestOf
    const s = body.payload;
    data.status = s.games.length >= s.bestOf && s.current === s.games.length - 1 ? "done" : "draft";
  }
  if (body.title !== undefined) data.title = body.title.trim() || null;
  if (body.status !== undefined) data.status = body.status;

  const { count } = await prisma.fearlessSession.updateMany({ where: { id }, data });
  if (!count) return bad("Сессия не найдена", 404);
  return NextResponse.json(await prisma.fearlessSession.findUnique({ where: { id } }));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard("tools");
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");
  const { count } = await prisma.fearlessSession.deleteMany({ where: { id } });
  if (!count) return bad("Сессия не найдена", 404);
  return NextResponse.json({ ok: true });
}
