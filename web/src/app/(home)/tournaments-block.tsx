import Link from "next/link";
import { listTournaments, registrationOpen } from "@/lib/tournaments";
import { StatTile } from "@/components/pouf/blocks";
import { EmptyState } from "@/components/pouf/feedback";
import { TournamentStatus } from "@/app/_components/tournament-status";
import { Slab } from "./slab";
import { SlotDeck } from "./slot-deck";

// Турниры лиги на плите витрины — макет `design/home/Main.dc.html`, блок «Турниры».
//
// Три колонки, по одной на состояние: что идёт, что набирает заявки, что уже сыграно. Разрезов
// вкладками (`/?t=next`) здесь больше нет: макет показывает все три состояния разом, и это честнее
// — вкладка «Прошедшие» скрывала соседей ради списка из одного элемента. Полный список — по ссылке
// «все турниры».
//
// В колонке лежат ВСЕ турниры своего состояния, а не первый попавшийся (ТЗ 23): двух открытых
// наборов в лиге достаточно, чтобы второй, отброшенный витриной, не собрал ни одной заявки.
// Показывается по одной карточке, соседи — стрелками `SlotDeck`.
//
// Черновики не показываем: турнир становится событием лиги, когда его открыли на заявки, — до
// этого он рабочая заготовка оператора.

type Row = Awaited<ReturnType<typeof listTournaments>>[number];

/** Порядок колонок на плите — он же порядок состояний турнира во времени. */
const SLOTS = ["running", "registration", "finished"] as const;

const EMPTY_SLOT: Record<(typeof SLOTS)[number], string> = {
  running: "Идущих турниров\nпока нет",
  registration: "Приём заявок\nзакрыт",
  finished: "Завершённых турниров\nпока нет",
};

const date = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", year: "numeric" });
const shortDate = new Intl.DateTimeFormat("ru", { day: "2-digit", month: "2-digit" });

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
  const teams = t.divisions.reduce((n, d) => n + d._count.entries, 0);
  return (
    <article className="flex flex-1 flex-col gap-4 rounded-card bg-surface p-[22px] cushion-card">
      <div>
        <TournamentStatus status={t.status} />
      </div>
      <div className="min-w-0">
        <h3 className="text-xl font-black tracking-[-0.5px]">
          <Link href={`/tournaments/${t.slug}`} className="hover:text-[var(--accent-ink)]">
            {t.name}
          </Link>
        </h3>
        {subtitle(t) && (
          <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.8px] text-ink-subtle">{subtitle(t)}</p>
        )}
      </div>
      {/* Два показателя из макета. «Набрано N из M» со шкалой заполнения не рисуем: размера сетки
          у турнира в модели нет, и знаменатель пришлось бы выдумать. */}
      <div className="mt-auto grid grid-cols-2 gap-3">
        <StatTile label="Команд" value={teams} />
        <StatTile label="Призовой" value={t.prize ?? "—"} />
      </div>
    </article>
  );
}

/** Пустой слот состояния — вдавленная лунка из макета (`.tour.empty`), а не пропуск: без неё
 *  ряд из двух карточек растягивается и перестаёт совпадать с соседними плитами. */
function EmptySlot({ text }: { text: string }) {
  return (
    <div className="grid flex-1 place-items-center whitespace-pre-line rounded-card bg-surface-2 p-[22px] text-center text-[13.5px] font-extrabold leading-[1.5] text-muted cushion-field">
      {text}
    </div>
  );
}

export async function TournamentsBlock() {
  const all = await listTournaments();
  // «Приём заявок» — это не статус, а возможность подать: турнир со статусом `registration`, у
  // которого срок приёма уже прошёл, звать заявиться не должен. Правило одно на весь продукт —
  // `registrationOpen` (оно же у `/apply` и у кабинета новичка).
  const slots = SLOTS.map((status) => ({
    status,
    // Порядок внутри колонки — из источника: `listTournaments` уже сортирует по старту вниз.
    rows: status === "registration" ? all.filter(registrationOpen) : all.filter((t) => t.status === status),
  }));
  const any = slots.some((s) => s.rows.length > 0);

  return (
    <Slab title="Турниры" more={any ? { href: "/tournaments", label: "все турниры" } : undefined}>
      {any ? (
        // На телефоне колонки листаются вбок (аннотация `n-mob`): вертикальный список из трёх
        // карточек по 250px занимал бы весь первый экран и отодвигал матчи с баллами под сгиб.
        // Свайп остаётся свайпом — стрелки живут ВНУТРИ колонки и его не отменяют.
        // Отрицательные поля — чтобы подушки не обрезались краем полосы прокрутки.
        <div className="-mx-2 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-2 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0">
          {slots.map((s) => (
            <div key={s.status} className="flex w-[250px] shrink-0 snap-start flex-col gap-3 sm:w-auto">
              {s.rows.length > 0 ? (
                <SlotDeck cards={s.rows.map((t) => <Card key={t.id} t={t} />)} />
              ) : (
                <EmptySlot text={EMPTY_SLOT[s.status]} />
              )}
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
