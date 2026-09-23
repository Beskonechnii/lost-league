import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { setMixCupIntent } from "@/lib/mixcup";

// Клик «Участвовать» гостем на /mixcup/<slug>: сохраняет намерение в куку и уводит на вход
// (/me). Обычная ссылка, а не server action, — на этот момент сессии ещё нет и действовать не
// от кого. Кука (не query-параметр) выбрана нарочно: пережидает даже внешний редирект на Google
// (см. lib/mixcup.ts). Путь и не под /admin, и статичный сегмент "event" в адресе — чтобы не
// столкнуться с числовым `[id]` операторского API рядом (см. api/mixcup/[id]).

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await prisma.mixCupEvent.findUnique({ where: { slug }, select: { status: true } });
  if (event?.status === "open") await setMixCupIntent(slug);
  return NextResponse.redirect(new URL("/me", req.url));
}
