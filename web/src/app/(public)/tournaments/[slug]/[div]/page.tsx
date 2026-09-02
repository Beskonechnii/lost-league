import Link from "next/link";
import { notFound } from "next/navigation";
import { getGroupStage, groupStageDone, groupStageProgress } from "@/lib/group-stage";
import { divisionOfTournament } from "@/lib/tournaments";
import { can } from "@/lib/account";
import { SectionHeader } from "@/components/pouf/blocks";
import { Heading } from "@/components/pouf/text";
import { StandingsTable } from "./_components/standings-table";

export const dynamic = "force-dynamic";

// Корень дивизиона — «Таблица» из строки контекста: полная турнирная таблица по артборду Кита
// (место с рейкой зоны, И/В/П, разница карт, форма, очки, сортировка по колонкам). Считается
// только по групповым сериям (stage="group") — плей-офф и разовые матчи сюда не попадают.
//
// Сетка личных встреч («все со всеми») уехала на соседнюю вкладку «Группы»: на одном экране
// узкая таблица и широкая кросс-сетка делили ширину пополам, и обе теряли колонки. Теперь у
// таблицы вся колонка страницы, а у кросс-сетки — своя.

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
            <span className={done ? "text-[var(--accent-ink)]" : "text-[var(--color-warn-ink)]"}>
              сыграно {decided} из {expected} встреч{done ? " · стадия завершена" : ""}
            </span>
          ) : (
            <>Счёт и очки — из привязанных карт архива серий, автоматически</>
          )
        }
      />

      {tables.length === 0 ? (
        // Пустое состояние объясняет, что происходит, а не показывает пустоту. Команда заливки —
        // только оператору: посетителю она ничего не говорит, а страница из-за неё выглядела сломанной.
        <div className="rounded-card bg-surface-1 p-8 text-center font-pouf text-sm font-bold text-muted cushion-field">
          Групп ещё нет — жеребьёвка не проведена. Как только команды разложат по группам, здесь
          появится таблица дивизиона.
          {authed && (
            <span className="mt-2 block text-xs text-muted">
              Залить: <code>npx tsx scripts/import-group-stage.ts --sheet &lt;id&gt; --div {division.slug.replace("d", "")}</code>
            </span>
          )}
        </div>
      ) : (
        // Одна таблица на группу, а не одна на дивизион: команды разных групп между собой не
        // играли, и в общей таблице их очки несопоставимы (см. lib/standings.ts).
        <div className="space-y-8">
          {tables.map((t) => (
            <section key={t.group} className="space-y-4">
              <div className="flex items-baseline gap-2.5 font-pouf">
                <Heading level={2}>Группа {t.group}</Heading>
                <span className="text-xs font-bold text-muted">{t.rows.length} команд</span>
              </div>
              <StandingsTable rows={t.rows} relegation={t.relegation} />
            </section>
          ))}
        </div>
      )}

      {tables.length > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 font-pouf text-xs font-bold text-muted">
          <Link href={`/tournaments/${slug}/${division.slug}/groups`} className="hover:text-[var(--accent-ink)]">
            Личные встречи по группам →
          </Link>
          <Link href={`/tournaments/${slug}/${division.slug}/playoff`} className="hover:text-[var(--accent-ink)]">
            {done ? "Плей-офф с посевом из групп →" : "Плей-офф: посев встанет после последней встречи группы →"}
          </Link>
        </div>
      )}
    </div>
  );
}
