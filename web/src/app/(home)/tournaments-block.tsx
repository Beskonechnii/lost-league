import Link from "next/link";
import { isIndividual, listTournaments, registrationOpen, tournamentHref, TOURNAMENT_KIND_SHORT, type TournamentKind } from "@/lib/tournaments";
import { StatTile } from "@/components/pouf/blocks";
import { EmptyState } from "@/components/pouf/feedback";
import { Eyebrow } from "@/components/pouf/text";
import { Badge } from "@/components/pouf/media";
import { TournamentStatus } from "@/app/_components/tournament-status";
import { Slab } from "./slab";
import { SlotDeck } from "./slot-deck";

// Турниры лиги на плите витрины — макет `design/home/Main.dc.html`, блок «Турниры» (ТЗ 36).
//
// Группировка — не по трём статусам модели, а по двум состояниям, которые видит игрок: ещё можно
// записаться («Регистрация») или уже нет («Регистрация завершена» — идущие и сыгранные разом).
// Точный статус турнира при этом не теряется: пилюля `TournamentStatus` на карточке остаётся
// «Идёт» / «Приём заявок» / «Завершён» — огрубление только на уровне заголовка группы.
//
// В группе лежат ВСЕ турниры её состояния, а не первый попавшийся (ТЗ 23): двух открытых наборов
// в лиге достаточно, чтобы второй, отброшенный витриной, не собрал ни одной заявки. Показывается
// по одной карточке, соседи — стрелками `SlotDeck` (не меняется).
//
// Черновики не показываем: турнир становится событием лиги, когда его открыли на заявки, — до
// этого он рабочая заготовка оператора. Правило выпадает само: черновик не входит ни в
// «Регистрация» (не тот статус), ни в «Регистрация завершена» (тоже не тот статус).

type Row = Awaited<ReturnType<typeof listTournaments>>[number];

const date = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", year: "numeric" });
const shortDate = new Intl.DateTimeFormat("ru", { day: "2-digit", month: "2-digit" });

const DAY_MS = 24 * 60 * 60 * 1000;

/** Однодневный турнир — признак вычисляемый, поля в модели нет (развилка 4 ТЗ 36): даты заданы
 *  и разница между ними укладывается в сутки. Без `endAt` (даты доигрываются по ходу турнира)
 *  признака нет — ровно тот момент, когда диапазон дат в подписи карточки тоже ещё неполный. */
function isOneDay(t: Row): boolean {
  return !!t.startAt && !!t.endAt && t.endAt.getTime() - t.startAt.getTime() <= DAY_MS;
}

/** Подпись под именем турнира: сроки приёма у набора, промежуток у остальных. */
function subtitle(t: Row): string | null {
  if (t.status === "registration")
    return t.regCloseAt ? `Приём заявок до ${shortDate.format(t.regCloseAt)}` : "Приём заявок открыт";
  if (t.startAt && t.endAt) return `${date.format(t.startAt)} — ${date.format(t.endAt)}`;
  if (t.startAt) return `с ${date.format(t.startAt)}`;
  if (t.endAt) return `до ${date.format(t.endAt)}`;
  return t.format;
}

function Card({ t }: { t: Row }) {
  // Индивидуальный формат (ТЗ 37) считает записавшихся игроков: команд и дивизионов у него нет,
  // и плитка «Команд: 0» была бы не пустым значением, а неправдой.
  const individual = isIndividual(t);
  const teams = t.divisions.reduce((n, d) => n + d._count.entries, 0);
  return (
    <article className="flex flex-1 flex-col gap-4 rounded-card bg-surface p-[22px] cushion-card">
      <div className="flex items-center gap-2">
        <TournamentStatus status={t.status} />
        {individual && <Badge tone="mint">{TOURNAMENT_KIND_SHORT[t.kind as TournamentKind] ?? t.kind}</Badge>}
        {!individual && isOneDay(t) && <Badge tone="mint">1 день</Badge>}
      </div>
      <div className="min-w-0">
        <h3 className="text-xl font-black tracking-[-0.5px]">
          <Link href={tournamentHref(t)} className="hover:text-[var(--accent-ink)]">
            {t.name}
          </Link>
        </h3>
        {subtitle(t) && (
          <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.8px] text-ink-subtle">{subtitle(t)}</p>
        )}
      </div>
      {/* Два показателя из макета. «Набрано N из M» со шкалой заполнения не рисуем: размера сетки
          у турнира в модели нет, и знаменатель пришлось бы выдумать. */}
      {/* У индивидуального формата показатель один — записавшиеся: призового у него нет, и
          плитка «Призовой —» была бы пустым обещанием рядом с живым числом (ТЗ 37, Scope п.8). */}
      <div className={`mt-auto grid gap-3 ${individual ? "grid-cols-1" : "grid-cols-2"}`}>
        {individual ? (
          <StatTile label="Записалось" value={t._count.registrations} />
        ) : (
          <>
            <StatTile label="Команд" value={teams} />
            <StatTile label="Призовой" value={t.prize ?? "—"} />
          </>
        )}
      </div>
    </article>
  );
}

export async function TournamentsBlock() {
  const all = await listTournaments();
  // «Приём заявок» — это не статус, а возможность подать: правило одно на весь продукт —
  // `registrationOpen` (оно же у `/apply` и у кабинета новичка), второй копии условия не заводим.
  // «Регистрация завершена» — всё публичное, что не «Регистрация»: идёт, сыграно, а также набор
  // с истёкшим `regCloseAt` — раньше такой турнир не показывался нигде (баг), теперь виден здесь.
  const groups = [
    { label: "Регистрация", rows: all.filter(registrationOpen) },
    {
      label: "Регистрация завершена",
      rows: all.filter((t) => t.status === "running" || t.status === "finished" || (t.status === "registration" && !registrationOpen(t))),
    },
    // Группа без карточек не рендерится вовсе — ни заголовок, ни лунка-пустышка (DESIGN §2).
  ].filter((g) => g.rows.length > 0);
  const any = groups.length > 0;

  return (
    <Slab title="Турниры" more={any ? { href: "/tournaments", label: "все турниры" } : undefined}>
      {any ? (
        // Лента групп, не сетка с зашитым числом колонок: `flex-wrap` разносит группы по ширине
        // сам, третья группа в будущем перенесётся на новую строку, а не сожмёт первые две.
        // На телефоне группы стоят в столбик — обе имеют право быть видны без свайпа, прятать
        // «Регистрацию» (решение записаться принимается здесь) за жестом нельзя.
        <div className="flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:gap-5">
          {groups.map((g) => (
            <div key={g.label} className="flex flex-col gap-3 sm:flex-1 sm:basis-[300px]">
              <Eyebrow>{g.label}</Eyebrow>
              {/* Внутри группы — та же листалка «карточка + стрелки», ширина 250px на телефоне
                  сохраняет прежний размер карточки на первом экране. */}
              <div className="w-[250px] shrink-0 sm:w-auto">
                <SlotDeck cards={g.rows.map((t) => <Card key={t.id} t={t} />)} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon="trophy" title="Турниров ещё нет">
          Как только организатор откроет первый турнир, он встанет здесь — со статусом, составом и
          призовым.
        </EmptyState>
      )}
    </Slab>
  );
}
