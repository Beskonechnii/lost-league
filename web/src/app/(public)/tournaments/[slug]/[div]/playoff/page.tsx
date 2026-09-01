import Link from "next/link";
import { notFound } from "next/navigation";
import { divisionOfTournament } from "@/lib/tournaments";
import { QUALIFICATION } from "@/lib/qualification";
import { resolveBracket } from "@/lib/playoff";
import { Eyebrow } from "@/components/pouf/text";
import { SectionHeader } from "@/components/pouf/blocks";
import { BracketView } from "./_components/bracket";

export const dynamic = "force-dynamic";

// Сетка плей-офф из живых данных: посев — из групп, участники поздних слотов вычисляются из
// исходов ранних (см. src/lib/playoff.ts). Счёт и продвижение берутся из архива серий, руками
// здесь ничего не задаётся: страница — отражение того, что заведено в /admin/series.

export default async function PlayoffPage({ params }: { params: Promise<{ slug: string; div: string }> }) {
  const { slug, div } = await params;
  const division = await divisionOfTournament(slug, div);
  if (!division) notFound();

  const bracket = await resolveBracket(division.id);
  const { done, decided, expected } = bracket.groupStage;
  // Жеребьёвки нет вовсе — показывать нечего: в сетке не будет даже заглушек с номерами посева.
  if (expected === 0) {
    return <p className="font-pouf font-bold text-muted">Группы ещё не разведены — сетка появится после жеребьёвки.</p>;
  }

  return (
    <div className="space-y-8 font-pouf">
      <SectionHeader
        eyebrow={`${division.label ?? division.name} · плей-офф`}
        title="Плей-офф"
        aside={<span className="text-ink-subtle">Сетка и счёт — из архива серий</span>}
      />

      {/* Пока группа не доиграна, участников в сетке нет: команды подставляются только по итогам
          стадии, а не из текущих позиций таблицы (решение 23.08.2026). Здесь же — чем именно
          стадия не закрыта, чтобы не гадать. */}
      {!done && (
        <p className="rounded-[14px] bg-surface px-4 py-3 text-sm font-bold text-ink-muted cushion-field">
          Групповая стадия не завершена: сыграно {decided} из {expected} встреч. Команды встанут в
          сетку, когда у всех встреч группы будет результат.
        </p>
      )}

      {/* Сетка живёт в общей колонке SITE_MAX_W, как и весь сайт: её край совпадает с шапкой,
          подменю и заголовком. AutoScale подгоняет сетку под ширину колонки (натуральная ширина
          ≈ ширине колонки, поэтому масштаб близок к 1:1). */}
      <BracketView slots={bracket.slots} />

      {/* Не прошедшие из групп — вылет ещё до сетки. */}
      {bracket.out.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${QUALIFICATION.out.marker}`} />
            <Eyebrow className="text-ink-muted">Вылет из групп</Eyebrow>
          </div>
          <div className="flex flex-wrap gap-2">
            {bracket.out.map((t) => (
              <Link
                key={t.teamId}
                href={`/roster/teams/${t.teamId}`}
                className="rounded-[14px] bg-surface px-3 py-1.5 text-xs font-bold text-ink-muted cushion-field transition hover:text-rose-700"
              >
                {t.name}
                <span className="ml-1 text-muted">
                  {t.group}
                  {t.place}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
