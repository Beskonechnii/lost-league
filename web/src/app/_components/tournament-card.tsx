import Link from "next/link";
import {
  isIndividual,
  registrationOpen,
  tournamentHref,
  tournamentSeats,
  TOURNAMENT_KIND_SHORT,
  type listTournaments,
  type TournamentKind,
} from "@/lib/tournaments";
import { withPlural } from "@/lib/plural";
import { buttonClasses } from "@/components/pouf/Button";
import { Capacity } from "@/components/pouf/capacity";
import { Chip, StatTile } from "@/components/pouf/blocks";
import { Grid } from "@/components/pouf/layout";
import { Card, RowCard } from "@/components/pouf/surface";
import { Heading, Text } from "@/components/pouf/text";
import { TournamentStatus } from "@/app/_components/tournament-status";

/* Турнир одной сущностью в трёх видах: лицо раздела, карточка в группе серии, строка хронологии.
 * До ТЗ 09 карточку верстали руками дважды разными классами — в списке турниров и в блоке турниров
 * на главной; здесь собран один вид на весь раздел. Главная переезжает сюда отдельным пунктом
 * (строка в BACKLOG.md) — пока обе вёрстки живы, правка карточки требует двух правок.
 *
 * Компонент живёт в `app/_components/`, а не в Ките: он знает модель турнира (дивизионы, участие,
 * приём заявок), а Кит про неё знать не должен. Из Кита сюда приезжают атомы — Card, Chip,
 * Capacity, StatTile.
 */

export type TournamentRow = Awaited<ReturnType<typeof listTournaments>>[number];

const long = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", year: "numeric" });
const short = new Intl.DateTimeFormat("ru", { day: "2-digit", month: "2-digit" });

/** Промежуток турнира словами: обе даты, одна или ничего — пустых тире в строке быть не должно. */
export function period(t: TournamentRow) {
  if (t.startAt && t.endAt) return `${long.format(t.startAt)} — ${long.format(t.endAt)}`;
  if (t.startAt) return `с ${long.format(t.startAt)}`;
  if (t.endAt) return `до ${long.format(t.endAt)}`;
  return null;
}

/** Короткие даты для ленты: «12.02 — 30.03». Без дат строка молчит, а не печатает тире. */
const shortPeriod = (t: TournamentRow) =>
  t.startAt && t.endAt
    ? `${short.format(t.startAt)} — ${short.format(t.endAt)}`
    : t.startAt
      ? short.format(t.startAt)
      : t.endAt
        ? `до ${short.format(t.endAt)}`
        : null;

/** Больше шести плиток внутри карточки турнира превращают список турниров в список дивизионов. */
const MAX_DIVISION_CARDS = 6;

const divisionTitle = (d: TournamentRow["divisions"][number]) => d.label ?? d.name;

/**
 * Дивизионы турнира. Каждый — своя подушка со своим счётчиком и своей ссылкой (решение Стаса
 * «каждый див своей карточкой»): прежний чип-ссылка не нёс ничего, кроме имени.
 *
 * Акцент дивизиона сюда не переносим: ряд разноцветных подушек читается как четыре статуса, а это
 * одна сущность в четырёх экземплярах. Сетка — `Grid cols="fit"` из Кита: она меряет карточку, а
 * не окно, поэтому число плиток в ряду зависит от того, где карточка стоит (лицо раздела или
 * колонка серии), а не от ширины экрана.
 */
function Divisions({ t }: { t: TournamentRow }) {
  if (t.divisions.length === 0) return <Text muted size="sm">Дивизионы ещё не заведены</Text>;

  if (t.divisions.length > MAX_DIVISION_CARDS) {
    const seats = tournamentSeats(t.divisions);
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Text muted size="sm">{withPlural(t.divisions.length, "дивизион", "дивизиона", "дивизионов")} ·</Text>
        <Capacity taken={seats.taken} limit={seats.limit} size="sm" meter={false} />
      </div>
    );
  }

  return (
    <Grid cols="fit" gap={2}>
      {t.divisions.map((d) => (
        <Link
          key={d.id}
          href={`/tournaments/${t.slug}/${d.slug}`}
          className="block min-h-[44px] rounded-card focus-visible:outline-none focus-visible:[box-shadow:var(--sh-focus)]"
        >
          <Card variant="tight">
            <div className="truncate font-pouf font-black text-ink" title={divisionTitle(d)}>
              {divisionTitle(d)}
            </div>
            <div className="mt-1">
              <Capacity taken={d._count.entries} limit={d.teamLimit} size="sm" />
            </div>
          </Card>
        </Link>
      ))}
    </Grid>
  );
}

function Actions({ t, block }: { t: TournamentRow; block: boolean }) {
  const size = block ? "md" : "sm";
  // До 640 кнопка во всю ширину: в две колонки они там не встают, а половинная кнопка под пальцем
  // читается как неактивная.
  const wide = "w-full justify-center sm:w-auto";

  // Индивидуальный формат — одна кнопка: заявки командой у него не бывает, а «Открыть турнир»
  // и «Записаться» ведут на один и тот же адрес, и две кнопки рядом были бы одним входом дважды.
  if (isIndividual(t)) {
    const open = registrationOpen(t);
    return (
      <div className="flex flex-wrap gap-2">
        <Link
          href={tournamentHref(t)}
          className={buttonClasses({ size, variant: open ? "solid" : "quiet", className: wide })}
        >
          {open ? "Записаться" : "Открыть"}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/tournaments/${t.slug}`} className={buttonClasses({ size, className: wide })}>
        Открыть турнир
      </Link>
      {registrationOpen(t) && (
        <Link
          href={`/tournaments/${t.slug}/apply`}
          className={buttonClasses({ size, variant: "quiet", className: wide })}
        >
          Подать заявку командой
        </Link>
      )}
    </div>
  );
}

/**
 * Карточка турнира. `face` — лицо раздела: турнир во всю ширину колонки, показатели и кнопки
 * отдельным столбцом справа. Описание в лице не печатается: оно съедает первый экран, а полный
 * текст есть на вкладке «О турнире».
 *
 * Чип серии рисуется только в лице: внутри группы серия уже написана в заголовке H2.
 */
export function TournamentCard({ t, face = false }: { t: TournamentRow; face?: boolean }) {
  const seats = tournamentSeats(t.divisions);
  // Индивидуальный формат считает записавшихся игроков, а не команды по дивизионам (ТЗ 37):
  // дивизионов у него нет вовсе, и блок «Дивизионы ещё не заведены» врал бы обещанием.
  const individual = isIndividual(t);
  // В лице призовой вынесен плиткой вправо — в строке фактов его не повторяем. Формат остаётся
  // в строке: это фраза («2 дивизиона, группа + плей-офф»), а не показатель, и в плитке он
  // набирается крупным жирным в шесть строк.
  const facts = [period(t), t.format, !face && t.prize && `призовой ${t.prize}`].filter(Boolean);
  const hasSeats = !individual && t.divisions.length > 0 && t.divisions.length <= MAX_DIVISION_CARDS;

  const head = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <TournamentStatus status={t.status} />
        {/* Слот чипа один: у сезонного турнира в нём серия, у индивидуального — имя формата.
            Серии у форматов нет, поэтому они не конкурируют. Формат показываем и в ленте, не
            только в лице: это единственное, чем карточка отличается от сезонной. */}
        {individual ? (
          <Chip>{TOURNAMENT_KIND_SHORT[t.kind as TournamentKind] ?? t.kind}</Chip>
        ) : (
          face &&
          t.series && (
            <Chip className="max-w-[12rem] truncate" title={t.series}>
              {t.series}
            </Chip>
          )
        )}
      </div>

      <div className="mt-3">
        <Heading level={3}>
          <Link href={tournamentHref(t)} className="break-words hover:text-[var(--accent-ink)]">
            {t.name}
          </Link>
        </Heading>
      </div>

      {facts.length > 0 && (
        // Строка фактов — ровно одна строка: на 450px «даты · формат» переносятся на две и
        // карточка вырастает на высоту, которой в ряду серии нет. Полный текст — подсказкой.
        <p className="mt-1.5 truncate" title={facts.join(" · ")}>
          <Text muted size="sm">{facts.join(" · ")}</Text>
        </p>
      )}
    </>
  );

  if (face) {
    return (
      <Card motion="lift">
        <Grid cols="sidebar" gap={5}>
          <div className="min-w-0">
            {head}
            {/* Счётчика мест у турнира без дивизионов нет: «0 из 0» — вранье, а не пустое значение. */}
            {hasSeats && (
              <div className="mt-4">
                <Capacity taken={seats.taken} limit={seats.limit} />
              </div>
            )}
            {!individual && (
              <div className="mt-4">
                <Divisions t={t} />
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            {/* У индивидуального формата колонка не пустует: вместо мест по дивизионам — счётчик
                записавшихся (лимит появится в ТЗ 39). */}
            {individual && <Capacity taken={t._count.registrations} limit={null} unit="players" />}
            {t.prize && <StatTile label="Призовой" value={t.prize} />}
            <Actions t={t} block />
          </div>
        </Grid>
      </Card>
    );
  }

  // Карточка ряда серии тянется на высоту ряда (сетка растягивает ячейки), а кнопки прижаты к её
  // низу через `mt-auto`: иначе у соседей по ряду ряды кнопок стоят на разной высоте и ряд читается
  // как три разных блока. Описания здесь нет по той же причине, что и в лице: оно съедает высоту,
  // а полный текст живёт на вкладке «О турнире».
  return (
    <Card motion="lift">
      <div className="flex h-full flex-col">
        {head}
        {hasSeats && (
          <div className="mt-4">
            <Capacity taken={seats.taken} limit={seats.limit} />
          </div>
        )}
        {individual && (
          <div className="mt-4">
            <Capacity taken={t._count.registrations} limit={null} unit="players" />
          </div>
        )}
        {!individual && (
          <div className="mt-4">
            <Divisions t={t} />
          </div>
        )}
        <div className="mt-auto pt-4">
          <Actions t={t} block={false} />
        </div>
      </div>
    </Card>
  );
}

/**
 * Третий вид того же турнира — строка хронологии. Подушка-строка, а не ячейка таблицы: турнир —
 * сущность, и `DataTable` здесь дал бы список ячеек вместо списка событий лиги.
 */
export function TournamentRowCard({ t }: { t: TournamentRow }) {
  const seats = tournamentSeats(t.divisions);
  const dates = shortPeriod(t);

  return (
    <Link
      href={tournamentHref(t)}
      className="block rounded-control focus-visible:outline-none focus-visible:[box-shadow:var(--sh-focus)]"
    >
      <RowCard>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {dates && <Text muted size="sm" num>{dates}</Text>}
            <span className="font-pouf font-black text-ink">{t.name}</span>
            {isIndividual(t) ? (
              <Chip>{TOURNAMENT_KIND_SHORT[t.kind as TournamentKind] ?? t.kind}</Chip>
            ) : (
              t.series && (
                <Chip className="max-w-[12rem] truncate" title={t.series}>
                  {t.series}
                </Chip>
              )
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <TournamentStatus status={t.status} />
            {/* Считает тот, кому есть что считать: у сезона — команды по дивизионам,
                у индивидуального формата — записавшихся. */}
            {isIndividual(t) ? (
              <Capacity taken={t._count.registrations} limit={null} unit="players" size="sm" meter={false} />
            ) : (
              t.divisions.length > 0 && <Capacity taken={seats.taken} limit={seats.limit} size="sm" meter={false} />
            )}
          </div>
        </div>
      </RowCard>
    </Link>
  );
}
