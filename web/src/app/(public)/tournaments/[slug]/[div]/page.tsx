import Link from "next/link";
import { notFound } from "next/navigation";
import { getGroupStage, groupStageDone, groupStageProgress } from "@/lib/group-stage";
import { QUALIFICATION } from "@/lib/qualification";
import { divisionOfTournament } from "@/lib/tournaments";
import { Chip, SectionHeader } from "@/app/_components/ui";
import { GroupStage } from "../../_components/group-stage";

export const dynamic = "force-dynamic";

// Корень дивизиона: таблицы групп и сетка личных встреч. Это и есть «Таблица» из строки контекста —
// раньше здесь стоял экран плиток, а таблица пряталась ещё одним кликом ниже, на /groups. Считается
// только по групповым сериям (stage="group") — плей-офф и разовые матчи сюда не попадают.
export default async function StandingsPage({ params }: { params: Promise<{ slug: string; div: string }> }) {
  const { slug, div } = await params;
  const division = await divisionOfTournament(slug, div);
  if (!division) notFound();

  const tables = await getGroupStage(division.id);
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
            <span className={done ? "text-emerald-400" : "text-amber-400"}>
              сыграно {decided} из {expected} встреч{done ? " · стадия завершена" : ""}
            </span>
          ) : (
            <>Счёт и очки — из привязанных карт архива серий, автоматически</>
          )
        }
      />

      {/* легенда зон: те же цвета, что и рейка слева от места. В D2 вылета из группы нет — чип не показываем */}
      <div className="flex flex-wrap gap-2">
        {(division.name === "Division 2" ? (["upper", "lower"] as const) : (["upper", "lower", "out"] as const)).map((k) => (
          <Chip key={k}>
            <span className={`h-2 w-2 rounded-full ${QUALIFICATION[k].marker}`} />
            {QUALIFICATION[k].label}
          </Chip>
        ))}
      </div>

      {tables.length === 0 ? (
        <p className="text-ink-muted">
          Данных нет. Залить:{" "}
          <code className="text-ink-muted">
            npx tsx scripts/import-group-stage.ts --sheet &lt;id&gt; --div {division.slug.replace("d", "")}
          </code>
        </p>
      ) : (
        <GroupStage tables={tables} />
      )}

      <Link href={`/tournaments/${slug}/${division.slug}/playoff`} className="inline-block font-pouf text-xs font-bold text-muted hover:text-[var(--purple)]">
        {done ? "Дальше — плей-офф с посевом из групп →" : "Плей-офф: посев встанет после последней встречи группы →"}
      </Link>
    </div>
  );
}
