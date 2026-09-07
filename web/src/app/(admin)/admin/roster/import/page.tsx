import { listTournaments } from "@/lib/tournaments";
import { denyUnlessPermission } from "../../../_components/permission-gate";
import { AdminHeader } from "../../../_components/admin-header";
import { ImportForm } from "./import-form";
import { FORM_MAX_W } from "@/components/pouf/blocks";

export const dynamic = "force-dynamic";
export const metadata = { title: "Импорт составов" };

// Импорт составов — отдельная фича (решение 04.09.2026), не привязанная к карточке одного турнира:
// разбор таблицы вообще не знает про турнир, а назначение (в какой дивизион или в общий пул без
// привязки) выбирается на последнем шаге мастера, из любого турнира сразу. То, что раньше делалось
// из терминала двумя скриптами (sheet-to-roster → import-roster), теперь мастер в три шага —
// источник, разбор, запись.

export default async function RosterImportPage({
  searchParams,
}: {
  /** Пришли со страницы конкретного турнира — предвыбираем его первый дивизион, а не общий пул. */
  searchParams: Promise<{ tournament?: string }>;
}) {
  const denied = await denyUnlessPermission("tournaments.edit", "Импорт составов");
  if (denied) return denied;

  const { tournament: fromSlug } = await searchParams;
  const tournaments = await listTournaments();
  const from = fromSlug ? tournaments.find((t) => t.slug === fromSlug) : null;

  return (
    <main className={`mx-auto w-full ${FORM_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <AdminHeader title="Импорт составов">
        Понимаем два вида таблиц: с шапкой колонок («Команда», «Ник», «Роль», «MMR», «Ссылка») и
        блочную раскладку сезонной таблицы LOST — пробуем обе и берём ту, где игроков нашлось больше.
        Ссылки читаем и из текста ячейки, и из гиперссылки, из них же выводится account_id. Куда
        записать — дивизион любого турнира или общий пул без привязки — решаете на последнем шаге,
        после того как увидите, что разобралось. В ростер ничего не попадёт раньше.
      </AdminHeader>

      <div className="mt-6">
        <ImportForm
          tournaments={tournaments.map((t) => ({
            slug: t.slug,
            name: t.name,
            divisions: t.divisions.map((d) => ({ id: d.id, name: d.short ?? d.name })),
          }))}
          defaultDivisionId={from?.divisions[0]?.id ?? null}
        />
      </div>
    </main>
  );
}
