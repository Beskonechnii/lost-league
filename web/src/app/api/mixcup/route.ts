import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/api-guard";
import { uniqueMixCupSlug } from "@/lib/mixcup";

// Создание события Mix Cup. Список читает страница напрямую из Prisma (как /underbeer) —
// отдельного GET здесь не заводим, он никем не читается.

export async function POST() {
  const denied = await guard("mixcup");
  if (denied) return denied;
  // Слаг зависит от id (конвенция: ставится один раз и не меняется) — заводим временный
  // уникальный, а затем переписываем на финальный тем же приёмом, что везде в проекте нет —
  // здесь id известен только после вставки, поэтому строка правится вторым запросом.
  const created = await prisma.mixCupEvent.create({ data: { slug: `mixcup-${Date.now()}` } });
  const slug = await uniqueMixCupSlug(null, created.id);
  const event = await prisma.mixCupEvent.update({ where: { id: created.id }, data: { slug } });
  return NextResponse.json(event, { status: 201 });
}
