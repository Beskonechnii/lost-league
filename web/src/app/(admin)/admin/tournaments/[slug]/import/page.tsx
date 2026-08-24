import Link from "next/link";
import { notFound } from "next/navigation";
import { tournamentBySlug } from "@/lib/tournaments";
import { denyUnlessPermission } from "../../../../_components/permission-gate";
import { ImportForm } from "./import-form";
import { FORM_MAX_W } from "@/app/_components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Импорт составов" };

// Импорт составов файлом: то, что раньше делалось из терминала двумя скриптами
// (sheet-to-roster → import-roster), теперь делается отсюда мастером в три шага —
// источник, разбор, запись.

export default async function ImportPage({ params }: { params: Promise<{ slug: string }> }) {
  const denied = await denyUnlessPermission("tournaments.edit", "Импорт составов");
  if (denied) return denied;

  const { slug } = await params;
  const tournament = await tournamentBySlug(slug);
  if (!tournament) notFound();

  return (
    <main className={`mx-auto w-full ${FORM_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <Link href={`/admin/tournaments/${tournament.slug}`} className="text-xs text-ink-subtle hover:text-ink">
        ← {tournament.name}
      </Link>
      <h1 className="mt-2 text-xl font-bold tracking-tight">Импорт составов</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Понимаем два вида таблиц: с шапкой колонок («Команда», «Ник», «Роль», «MMR», «Ссылка») и
        блочную раскладку сезонной таблицы LOST — пробуем обе и берём ту, где игроков нашлось больше.
        Ссылки читаем и из текста ячейки, и из гиперссылки, из них же выводится account_id.
        В ростер ничего не попадёт, пока вы не дойдёте до шага «Запись».
      </p>

      <div className="mt-6">
        <ImportForm
          tournamentSlug={tournament.slug}
          divisions={tournament.divisions.map((d) => ({ id: d.id, name: d.name, short: d.short ?? d.slug }))}
        />
      </div>
    </main>
  );
}
