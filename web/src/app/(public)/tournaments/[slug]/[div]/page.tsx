import Link from "next/link";
import { notFound } from "next/navigation";
import { getGroupStage, groupStageDone, groupStageProgress } from "@/lib/group-stage";
import { QUALIFICATION } from "@/lib/qualification";
import { divisionOfTournament } from "@/lib/tournaments";
import { can } from "@/lib/account";
import { Chip, SectionHeader } from "@/components/pouf/blocks";
import { GroupStage } from "../../_components/group-stage";

export const dynamic = "force-dynamic";

// Корень дивизиона: таблицы групп и сетка личных встреч. Это и есть «Таблица» из строки контекста —
// раньше здесь стоял экран плиток, а таблица пряталась ещё одним кликом ниже, на /groups. Считается
// только по групповым сериям (stage="group") — плей-офф и разовые матчи сюда не попадают.
export default async function StandingsPage({ params }: { params: Promise<{ slug: string; div: string }> }) {
  const { slug, div } = await params;
  const division = await divisionOfTournament(slug, div);
  if (!division) notFound();

  const [tables, authed] = await Promise.all([getGroupStage(division.id), can("series.edit")]);
  // Сколько встреч сыграно из ожидаемых по жеребьёвке. Стадия закрывается автоматически, когда у
  // всех встреч есть результат, поэтому недостачу («встречу ещё не завели») оператор должен видеть
  // числом: иначе плей-офф разберёт посев раньше времени и никто не поймёт, почему.
  const { decided, expected } = groupStageProgress(tables);
  const done = groupStageDone(tables);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={division.tournament.name}
        title={division.label ?? division.name}
        aside={
          expected > 0 ? (
            <span className={done ? "text-emerald-700" : "text-amber-700"}>
              сыграно {decided} из {expected} встреч{done ? " · стадия завершена" : ""}
            </span>
          ) : (
            <>Счёт и очки — из привязанных карт архива серий, автоматически</>
          )
        }
      />

      {/* легенда зон: те же цвета, что и рейка слева от места. В D2 вылета из группы нет — чип не
          показываем. Пустой таблице легенда не нужна: объяснять нечего */}
      <div className={`flex flex-wrap gap-2 ${tables.length === 0 ? "hidden" : ""}`}>
        {(division.name === "Division 2" ? (["upper", "lower"] as const) : (["upper", "lower", "out"] as const)).map((k) => (
          <Chip key={k}>
            <span className={`h-2 w-2 rounded-full ${QUALIFICATION[k].marker}`} />
            {QUALIFICATION[k].label}
          </Chip>
        ))}
      </div>

      {tables.length === 0 ? (
        // Пустое состояние объясняет, что происходит, а не показывает пустоту. Команда заливки —
        // только оператору: посетителю она ничего не говорит, а страница из-за неё выглядела сломанной.
        <div className="rounded-card bg-surface p-8 text-center text-sm font-bold text-muted cushion-field">
          Групп ещё нет — жеребьёвка не проведена. Как только команды разложат по группам, здесь
          появятся таблицы и сетка личных встреч.
          {authed && (
            <span className="mt-2 block text-xs text-ink-subtle">
              Залить: <code>npx tsx scripts/import-group-stage.ts --sheet &lt;id&gt; --div {division.slug.replace("d", "")}</code>
            </span>
          )}
        </div>
      ) : (
        <GroupStage tables={tables} />
      )}

      <Link href={`/tournaments/${slug}/${division.slug}/playoff`} className="inline-block font-pouf text-xs font-bold text-muted hover:text-[var(--accent-ink)]">
        {done ? "Дальше — плей-офф с посевом из групп →" : "Плей-офф: посев встанет после последней встречи группы →"}
      </Link>
    </div>
  );
}
