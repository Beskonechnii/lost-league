import Link from "next/link";
import { listTournaments, registrationOpen } from "@/lib/tournaments";
import { buttonClasses } from "@/components/pouf/Button";
import { Eyebrow } from "@/components/pouf/text";
import { EmptyState } from "@/components/pouf/feedback";
import { PillLink } from "@/components/pouf/tabs";
import { TournamentStatus } from "@/app/_components/tournament-status";

// Турниры лиги на витрине — тремя разрезами: что идёт, что впереди, что уже сыграно.
//
// Разрез живёт в адресе (`/?t=next`), а не в состоянии клиента: правило L4 стандарта — ссылку на
// разрез должно быть можно кинуть в чат. Заодно блок остаётся серверным, без «use client» ради
// трёх кнопок.
//
// Черновики не показываем: турнир становится событием лиги, когда его открыли на заявки, — до
// этого он рабочая заготовка оператора.

type Row = Awaited<ReturnType<typeof listTournaments>>[number];

const CUTS = ["now", "next", "past"] as const;
export type TournamentCut = (typeof CUTS)[number];
export const isTournamentCut = (v: string | undefined): v is TournamentCut =>
  (CUTS as readonly string[]).includes(v ?? "");

const CUT_LABELS: Record<TournamentCut, string> = { now: "Идут", next: "Впереди", past: "Прошедшие" };

const date = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", year: "numeric" });

/** Промежуток турнира словами: обе даты, одна или ничего — пустых тире в строке быть не должно. */
function period(t: Row) {
  if (t.startAt && t.endAt) return `${date.format(t.startAt)} — ${date.format(t.endAt)}`;
  if (t.startAt) return `с ${date.format(t.startAt)}`;
  if (t.endAt) return `до ${date.format(t.endAt)}`;
  return null;
}

function Card({ t }: { t: Row }) {
  const facts = [period(t), t.format, t.prize && `призовой ${t.prize}`].filter(Boolean);
  return (
    <article className="flex flex-col rounded-card bg-surface p-5 cushion-card">
      <div className="flex flex-wrap items-center gap-2">
        <TournamentStatus status={t.status} />
      </div>
      <h3 className="mt-3 text-lg font-black tracking-tight">
        <Link href={`/tournaments/${t.slug}`} className="hover:text-[var(--accent-ink)]">
          {t.name}
        </Link>
      </h3>
      {facts.length > 0 && <p className="mt-1.5 text-[13px] font-bold text-muted">{facts.join(" · ")}</p>}

      {t.divisions.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {t.divisions.map((d) => (
            <li key={d.id}>
              <Link
                href={`/tournaments/${t.slug}/${d.slug}`}
                className="inline-flex rounded-chip bg-surface px-3 py-1.5 text-[13px] font-black text-ink cushion-field transition hover:text-[var(--accent-ink)]"
              >
                {d.label ?? d.name}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2 pt-1">
        <Link href={`/tournaments/${t.slug}`} className={buttonClasses({ size: "sm", variant: "quiet" })}>
          Открыть турнир
        </Link>
        {registrationOpen(t) && (
          <Link href={`/tournaments/${t.slug}/apply`} className={buttonClasses({ size: "sm" })}>
            Заявить команду
          </Link>
        )}
      </div>
    </article>
  );
}

export async function TournamentsBlock({ cut }: { cut?: TournamentCut }) {
  const all = await listTournaments();
  const groups: Record<TournamentCut, Row[]> = {
    now: all.filter((t) => t.status === "running"),
    next: all.filter((t) => t.status === "registration"),
    // Сыгранные — свежие сверху: `listTournaments` уже сортирует по дате старта вниз.
    past: all.filter((t) => t.status === "finished"),
  };

  // Разрез по умолчанию — первый непустой: у лиги без идущего сезона витрина не должна открываться
  // пустой вкладкой, когда рядом есть сыгранные турниры. Но ЯВНО выбранный разрез не подменяем,
  // даже пустой: молча показать другой список в ответ на нажатие — соврать про то, что нажали.
  const active = cut ?? CUTS.find((c) => groups[c].length > 0) ?? "now";
  const rows = groups[active];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Eyebrow>Турниры лиги</Eyebrow>
        <div className="flex flex-wrap gap-2">
          {CUTS.map((c) => (
            <PillLink key={c} href={`/?t=${c}`} active={c === active} size="sm" count={groups[c].length}>
              {CUT_LABELS[c]}
            </PillLink>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="trophy" title="Пока пусто">
          В этом разрезе турниров нет. Загляните в соседний — или откройте общий список.
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.slice(0, 3).map((t) => (
            <Card key={t.id} t={t} />
          ))}
        </div>
      )}

      {rows.length > 3 && (
        <p className="text-sm font-bold text-muted">
          <Link href="/tournaments" className="text-[var(--accent-ink)] hover:underline">
            Все турниры лиги
          </Link>{" "}
          — ещё {rows.length - 3}
        </p>
      )}
    </section>
  );
}
