import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SectionHeader, FORM_MAX_W } from "@/components/pouf/blocks";
import { EmptyState } from "@/components/pouf/feedback";

export const dynamic = "force-dynamic";

// Голый /mixcup — не страница, а адрес-указатель на «текущий» Mix Cup (решение 22.09.2026, ТЗ 34):
// открытая запись есть → туда, нет → на последний сыгранный, турниров формата не было → пусто.
// Само лицо турнира живёт на /join/<slug> (ТЗ 37).
export default async function MixCupCurrent() {
  const open = await prisma.tournament.findFirst({
    where: { kind: "mixcup", status: "registration" },
    orderBy: { id: "desc" },
  });
  if (open) redirect(`/join/${open.slug}`);

  const last = await prisma.tournament.findFirst({
    where: { kind: "mixcup" },
    orderBy: [{ startAt: "desc" }, { id: "desc" }],
  });
  if (last) redirect(`/join/${last.slug}`);

  return (
    <div className={`mx-auto w-full ${FORM_MAX_W} space-y-6 px-4 py-10 font-pouf md:py-16`}>
      <SectionHeader eyebrow="Mix Cup" title="Mix Cup by Eclipse" />
      <EmptyState icon="flame" title="Mix Cup ещё не проводили">
        Турнир появится здесь, как только лига его заведёт.
      </EmptyState>
    </div>
  );
}
