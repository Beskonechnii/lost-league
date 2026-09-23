import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { withPlural } from "@/lib/plural";
import { buttonClasses } from "@/components/pouf/Button";
import { Alert } from "@/components/pouf/feedback";

// Секция «открыта регистрация на Mix Cup» (ТЗ 34) — отдельный компонент, НЕ часть
// `tournaments-block.tsx` (тот владеет турнирами, ТЗ 23): Mix Cup не Tournament, у него нет
// дивизионов и призового, подставить его в карточку блока турниров значит соврать показателями
// (см. «Граница с ТЗ 23» в ТЗ). Переиспользуем Alert Кита tone="info" block — тем же приёмом,
// каким уже составлены RosterSelect/ConfigControls в UNDERBEER, вместо нового атома.
//
// Одно место правды со страницей события: «приём открыт» значит ровно status === "open" у
// MixCupEvent — второго условия на витрине не заводим.
const dateFmt = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long" });

export async function MixCupSection() {
  const event = await prisma.mixCupEvent.findFirst({
    where: { status: "open" },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { registrations: true } } },
  });
  // Приём закрыт (или события ещё не заводили) — секции нет вовсе, не пустая плашка с другим
  // текстом (DESIGN §1 ТЗ 34).
  if (!event) return null;

  const name = event.title || `Mix Cup #${event.id}`;
  const count = event._count.registrations;

  return (
    <Alert tone="info" icon="flame" block>
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="font-black text-ink">Открыта регистрация: {name}</div>
          <div className="text-sm text-ink-muted">
            {event.playedAt ? dateFmt.format(event.playedAt) : "дата уточняется"} · записалось {withPlural(count, "игрок", "игрока", "игроков")}
          </div>
        </div>
        <Link href={`/mixcup/${event.slug}`} className={`${buttonClasses({ size: "md" })} w-full justify-center sm:w-auto`}>
          Участвовать →
        </Link>
      </div>
    </Alert>
  );
}
