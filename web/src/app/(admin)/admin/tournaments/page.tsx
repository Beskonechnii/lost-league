import Link from "next/link";
import { currentTournament, listTournaments } from "@/lib/tournaments";
import { Button } from "@/components/pouf/Button";
import { denyUnlessPermission } from "../../_components/permission-gate";
import { AdminHeader } from "../../_components/admin-header";
import { TournamentStatus } from "@/app/_components/tournament-status";
import { Chip, FORM_MAX_W } from "@/components/pouf/blocks";
import { EmptyState } from "@/components/pouf/feedback";
import { Card } from "@/components/pouf/surface";

export const dynamic = "force-dynamic";
export const metadata = { title: "Турниры" };

// Список турниров. Турнир — контейнер сезона: описание, даты, дивизионы и участники
// (TOURNAMENTS-PLAN.md). Раньше дивизионы были константой в коде, поэтому «завести сезон» означало
// правку исходников и деплой; теперь это форма.
//
// Турнир — сущность, поэтому строка списка это подушка-карточка, а не строка таблицы
// (UI-GUIDELINES §4, «Плотность»): у неё есть имя, статус и своя страница.

const date = new Intl.DateTimeFormat("ru", { day: "numeric", month: "short", year: "numeric" });
const range = (from: Date | null, to: Date | null) =>
  [from && date.format(from), to && date.format(to)].filter(Boolean).join(" — ") || "даты не заданы";

export default async function TournamentsPage() {
  const denied = await denyUnlessPermission("tournaments.edit", "Турниры");
  if (denied) return denied;

  const [tournaments, current] = await Promise.all([listTournaments(), currentTournament()]);

  return (
    <main className={`mx-auto w-full ${FORM_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      {/* Заведение турнира — действием страницы у заголовка (UI-GUIDELINES §4), а не формой в
          подвале списка: сезон это не одно описание, а цепочка «описание → дивизионы → составы →
          жеребьёвка», и мастер ведёт по ней по порядку. */}
      <AdminHeader
        title="Турниры"
        aside={
          <Link href="/admin/tournaments/new/describe">
            <Button type="button" size="sm">Завести турнир</Button>
          </Link>
        }
      >
        Сезон или кубок целиком: описание, сроки, дивизионы и составы. Публичные витрины показывают
        турнир со статусом «Идёт» — если такого нет, последний заведённый. Мастер заведения проведёт
        по шагам и создаст черновик уже на первом.
      </AdminHeader>

      <div className="mt-6">
        {tournaments.length === 0 ? (
          <EmptyState icon="trophy" title="Турниров пока нет">
            Сезон заводится мастером: описание → дивизионы → составы → жеребьёвка. Черновик не виден
            публично, пока вы сами не откроете приём заявок.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {tournaments.map((t) => (
              <li key={t.id}>
                <Link href={`/admin/tournaments/${t.slug}`} className="block">
                  <Card variant="tight" motion="lift">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 font-pouf">
                      <TournamentStatus status={t.status} />
                      <span className="text-[15px] font-black tracking-[-0.2px] text-ink">{t.name}</span>
                      <span className="text-xs font-bold text-muted">/{t.slug}</span>
                      {/* Какой турнир открывают витрины — видно сразу: при двух-трёх сразу
                          непонятно, чьи таблицы показывает сайт. */}
                      {t.id === current?.id && <Chip accent>текущий на сайте</Chip>}
                    </div>
                    <p className="mt-1.5 font-pouf text-xs font-bold text-muted">
                      {range(t.startAt, t.endAt)} · дивизионов: {t.divisions.length}
                      {t.divisions.length > 0 && ` (${t.divisions.map((d) => d.short ?? d.slug).join(", ")})`}
                    </p>
                    {t.description && (
                      <p className="mt-1.5 line-clamp-2 font-pouf text-sm font-bold text-ink-muted">
                        {t.description}
                      </p>
                    )}
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
