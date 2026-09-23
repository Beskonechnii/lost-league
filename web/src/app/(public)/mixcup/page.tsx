import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SectionHeader, FORM_MAX_W } from "@/components/pouf/blocks";
import { EmptyState } from "@/components/pouf/feedback";

export const dynamic = "force-dynamic";

// Голый /mixcup — не страница, а адрес-указатель на «текущий» Mix Cup (решение 22.09.2026, ТЗ 34):
// открытый приём есть → туда, нет → на последний сыгранный, событий вообще не было → пусто. Слаг
// в URL — потому что Mix Cup серия, и второй микс не должен ломать уже розданную на первый ссылку.
export default async function MixCupCurrent() {
  const open = await prisma.mixCupEvent.findFirst({ where: { status: "open" }, orderBy: { updatedAt: "desc" } });
  if (open) redirect(`/mixcup/${open.slug}`);

  const last = await prisma.mixCupEvent.findFirst({ orderBy: [{ playedAt: "desc" }, { updatedAt: "desc" }] });
  if (last) redirect(`/mixcup/${last.slug}`);

  return (
    <div className={`mx-auto w-full ${FORM_MAX_W} space-y-6 px-4 py-10 font-pouf md:py-16`}>
      <SectionHeader eyebrow="Mix Cup" title="Mix Cup by Eclipse" />
      <EmptyState icon="flame" title="Mix Cup ещё не проводили">
        Событие появится здесь, как только лига его заведёт.
      </EmptyState>
    </div>
  );
}
