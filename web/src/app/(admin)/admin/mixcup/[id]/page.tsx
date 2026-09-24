import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Старый адрес экрана события (ТЗ 33) — с ТЗ 37 событие это обычный турнир, и служебная карточка
// у него одна, общая: /admin/tournaments/<слаг>. Редирект, а не копия экрана: уже открытые
// вкладки и закладки оператора продолжают работать.

export default async function MixCupEventRedirect({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const tournament = await prisma.tournament.findUnique({ where: { id }, select: { slug: true } });
  if (!tournament) notFound();
  redirect(`/admin/tournaments/${tournament.slug}`);
}
