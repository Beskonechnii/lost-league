import { notFound } from "next/navigation";
import { getGroupStage, groupStageDone, groupStageProgress } from "@/lib/group-stage";
import { divisionOfTournament } from "@/lib/tournaments";
import { SectionHeader } from "@/components/pouf/blocks";
import { EmptyState } from "@/components/pouf/feedback";
import { GroupStage } from "../../../_components/group-stage";

export const dynamic = "force-dynamic";

// Групповой этап — блоки групп и кросс-таблица личных встреч. Отдельная вкладка, а не редирект на
// корень дивизиона (так было до Э5): на одном экране развёрнутая таблица и сетка «все со всеми»
// делят ширину пополам, и обе теряют колонки. Корень дивизиона показывает таблицу, эта страница —
// кто с кем как сыграл; ряд вкладок в строке турнира на них и рассчитан (UI-GUIDELINES §2, L3).

export async function generateMetadata({ params }: { params: Promise<{ slug: string; div: string }> }) {
  const { slug, div } = await params;
  const division = await divisionOfTournament(slug, div);
  return { title: division ? `${division.label ?? division.name} — групповой этап` : "Групповой этап" };
}

export default async function GroupsPage({ params }: { params: Promise<{ slug: string; div: string }> }) {
  const { slug, div } = await params;
  const division = await divisionOfTournament(slug, div);
  if (!division) notFound();

  const tables = await getGroupStage(division.id);
  const { decided, expected } = groupStageProgress(tables);
  const done = groupStageDone(tables);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`${division.label ?? division.name} · ${division.tournament.name}`}
        title="Групповой этап"
        aside={
          expected > 0 ? (
            <span className={done ? "text-[var(--accent-ink)]" : "text-[var(--color-warn-ink)]"}>
              сыграно {decided} из {expected} встреч{done ? " · стадия завершена" : ""}
            </span>
          ) : undefined
        }
      />

      {tables.length === 0 ? (
        <EmptyState icon="trophy" title="Групп ещё нет">
          Жеребьёвка не проведена. Как только команды разложат по группам, здесь появятся блоки
          групп и сетка личных встреч.
        </EmptyState>
      ) : (
        // Про бледные ячейки говорит легенда каждой кросс-сетки: «восстановлено расчётом» —
        // свойство своей группы, и общей сноской под страницей оно стояло не у своих данных.
        <GroupStage tables={tables} />
      )}
    </div>
  );
}
