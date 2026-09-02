import Link from "next/link";
import { tournamentArchive } from "@/lib/series";
import { SITE_MAX_W, Chip } from "@/components/pouf/blocks";
import { Card } from "@/components/pouf/surface";
import { EmptyState } from "@/components/pouf/feedback";
import { TournamentStatus } from "@/app/_components/tournament-status";
import { denyUnlessPermission } from "../../_components/permission-gate";
import { AdminHeader } from "../../_components/admin-header";

export const dynamic = "force-dynamic";

export const metadata = { title: "Архив серий" };

// Вход в архив: блоки турниров, а не все встречи разом. Техническая часть — заведение встречи,
// привязка и перечитывание карт — живёт на уровень глубже, в /admin/series/<турнир>: 90% времени
// оператору нужен один сезон, а страница читалась как приборная панель всех сезонов сразу.
//
// Свою таблицу тонов статуса (`bg-sky-500/20`, `bg-emerald-500/20`) экран больше не держит:
// статус турнира на весь продукт рисует `app/_components/tournament-status.tsx` (Э8).

export default async function SeriesArchiveHome() {
  const denied = await denyUnlessPermission("series.edit", "Архив серий");
  if (denied) return denied;

  const tournaments = await tournamentArchive();

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <AdminHeader title="Архив серий">
        Выберите турнир — встречи, карты и перечитывание статы внутри. Отсюда стата попадает в
        рейтинги: у встречи без карт в статистику не идёт ничего.
      </AdminHeader>

      <div className="mt-6">
        {tournaments.length === 0 ? (
          <EmptyState icon="trophy" title="Турниров ещё нет">
            Заведите первый в «Турнирах» — архив встреч появится вместе с сезоном.
          </EmptyState>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {tournaments.map((t) => (
              <li key={t.id}>
                <Link href={`/admin/series/${t.slug}`} className="block">
                  <Card variant="tight" motion="lift">
                    <div className="flex flex-wrap items-center gap-2 font-pouf">
                      <TournamentStatus status={t.status} />
                      <span className="text-[15px] font-black tracking-[-0.2px] text-ink">
                        {t.short ?? t.name}
                      </span>
                      {/* Незаполненные встречи — то, ради чего сюда и заходят: без карт нет статы. */}
                      {t.empty > 0 && <Chip accent className="ml-auto">{t.empty} без карт</Chip>}
                    </div>

                    <p className="mt-1.5 font-pouf text-xs font-bold text-muted">
                      {t.divisions.length > 0
                        ? t.divisions.map((d) => d.short ?? d.name).join(" · ")
                        : "дивизионов нет"}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-pouf text-sm font-bold tabular-nums text-muted">
                      <span>
                        <span className="font-black text-ink">{t.series}</span> встреч
                      </span>
                      <span>
                        <span className="font-black text-ink">{t.games}</span> карт привязано
                      </span>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
