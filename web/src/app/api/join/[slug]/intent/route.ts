import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { setJoinIntent, joinOpen } from "@/lib/mixcup";

// Клик «Участвовать» гостем на /join/<slug>: сохраняет намерение в куку и уводит на вход (/me).
// Обычная ссылка, а не server action, — на этот момент сессии ещё нет и действовать не от кого.
// Кука (не query-параметр) выбрана нарочно: пережидает даже внешний редирект на Google
// (см. lib/mixcup.ts).

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tournament = await prisma.tournament.findUnique({ where: { slug }, select: { kind: true, status: true } });
  if (tournament && joinOpen(tournament)) await setJoinIntent(slug);
  return NextResponse.redirect(new URL("/me", req.url));
}
