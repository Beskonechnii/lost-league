import Link from "next/link";
import { notFound } from "next/navigation";
import { divisionOfTournament } from "@/lib/tournaments";
import { resolveBracket } from "@/lib/playoff";
import { SectionHeader } from "@/components/pouf/blocks";
import { TeamMark, ZoneBar } from "@/components/pouf/table";
import { BracketView } from "./_components/bracket";

export const dynamic = "force-dynamic";

// Сетка плей-офф из живых данных: посев — из групп, участники поздних слотов вычисляются из
// исходов ранних (см. src/lib/playoff.ts). Счёт и продвижение берутся из архива серий, руками
// здесь ничего не задаётся: страница — отражение того, что заведено в /admin/series.

export async function generateMetadata({ params }: { params: Promise<{ slug: string; div: string }> }) {
  const { slug, div } = await params;
  const division = await divisionOfTournament(slug, div);
  return { title: division ? `${division.label ?? division.name} — плей-офф` : "Плей-офф" };
}

export default async function PlayoffPage({ params }: { params: Promise<{ slug: string; div: string }> }) {
  const { slug, div } = await params;
  const division = await divisionOfTournament(slug, div);
  if (!division) notFound();

  const bracket = await resolveBracket(division.id);
  const { done, decided, expected } = bracket.groupStage;

  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader
        eyebrow={`${division.label ?? division.name} · ${division.tournament.name}`}
        title="Плей-офф"
        aside={<span className="text-muted">Сетка и счёт — из архива серий</span>}
      />

      {/* Жеребьёвки нет вовсе — показывать нечего: в сетке не будет даже заглушек с номерами
          посева. Пустое состояние говорит, что это за экран и чего ждать. */}
      {expected === 0 ? (
        <div className="rounded-card bg-surface-1 p-8 text-center text-sm font-bold text-muted cushion-field">
          Сетки ещё нет: группы не разведены. Она соберётся сама, как только пройдёт жеребьёвка и
          команды доиграют групповой этап — посев берётся из итогов групп, а не назначается руками.
        </div>
      ) : (
        <>
          {/* Пока группа не доиграна, участников в сетке нет: команды подставляются только по итогам
              стадии, а не из текущих позиций таблицы (решение 23.08.2026). Здесь же — чем именно
              стадия не закрыта, чтобы не гадать. Плашка по Киту: алерт-предупреждение. */}
          {!done && (
            <p className="inline-flex items-start gap-2.5 rounded-chip bg-[image:var(--grad-warn)] px-4 py-3 text-[13px] font-extrabold text-[var(--color-warn-ink)] [box-shadow:var(--sh-raise-sm)]">
              <span className="mt-px grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/70 [box-shadow:inset_1px_1px_2px_#fff,0_3px_5px_-1px_rgba(0,0,0,.16)]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                  <path d="M12 8v5M12 17h.01" />
                </svg>
              </span>
              <span>
                Групповая стадия не завершена: сыграно {decided} из {expected} встреч. Команды встанут
                в сетку, когда у всех встреч группы будет результат.
              </span>
            </p>
          )}

          {/* Сетка живёт в общей колонке SITE_MAX_W, как и весь сайт: её край совпадает со строкой
              турнира и заголовком. AutoScale подгоняет её под ширину колонки, но не мельче 0.8 —
              дальше сетка листается вбок внутри своего контейнера. */}
          <BracketView slots={bracket.slots} />

          {/* Не прошедшие из групп — вылет ещё до сетки. */}
          {bracket.out.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2.5">
                <ZoneBar zone="out" height={18} />
                <span className="text-[13px] font-extrabold uppercase tracking-[2px] text-muted">
                  Вылет из групп
                </span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {bracket.out.map((t) => (
                  <Link
                    key={t.teamId}
                    href={`/roster/teams/${t.teamId}`}
                    className="flex items-center gap-2.5 rounded-[20px] bg-surface-1 px-3 py-2 text-[13px] font-extrabold text-ink cushion-row transition hover:-translate-y-0.5"
                  >
                    <TeamMark logo={t.logo} tag={t.tag} name={t.name} size={26} />
                    {t.name}
                    <span className="text-muted">
                      {t.group}
                      {t.place}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
