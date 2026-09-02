import { notFound } from "next/navigation";
import { getGroupStage, groupStageDone, groupStageProgress } from "@/lib/group-stage";
import { divisionOfTournament } from "@/lib/tournaments";
import { SectionHeader } from "@/components/pouf/blocks";
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
  const guessed = tables.reduce((n, t) => n + t.guessedCount, 0);

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
        <div className="rounded-card bg-surface-1 p-8 text-center font-pouf text-sm font-bold text-muted cushion-field">
          Групп ещё нет — жеребьёвка не проведена. Как только команды разложат по группам, здесь
          появятся блоки групп и сетка личных встреч.
        </div>
      ) : (
        <>
          <GroupStage tables={tables} />
          {/* Восстановленный расчётом счёт бледнее — и об этом надо сказать словами, а не оставить
              догадываться, почему часть ячеек выцветшая. */}
          {guessed > 0 && (
            <p className="font-pouf text-xs font-bold text-muted">
              Бледные ячейки — счёт восстановлен расчётом, а не прочитан из таблицы сезона
              ({guessed} из {decided}). Такие встречи стоит сверить руками.
            </p>
          )}
        </>
      )}
    </div>
  );
}
