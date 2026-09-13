import Link from "next/link";
import { registrationOpen, tournamentSeats, type listTournaments } from "@/lib/tournaments";
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
 * одна сущность в четырёх экземплярах. Сетка собрана классами карточки, а не `Grid` из Кита:
 * у `Grid` единственный порог 900px и меряет он окно, а не карточку, — внутри полуширинной
 * карточки он дал бы четыре колонки по ~130px (пункт в Кит, ТЗ 09 §7.3).
 */
function Divisions({ t, wide }: { t: TournamentRow; wide: boolean }) {
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
    // Один дивизион — одна карточка во всю ширину ряда: вторая пустая ячейка читается как «тут
    // что-то не загрузилось».
    <ul
      className={
        t.divisions.length === 1 ? "grid gap-2" : `grid grid-cols-2 gap-2 ${wide ? "md:grid-cols-4" : ""}`
      }
    >
      {t.divisions.map((d) => (
        <li key={d.id}>
          <Link
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
        </li>
      ))}
    </ul>
  );
}

function Actions({ t, block }: { t: TournamentRow; block: boolean }) {
  const size = block ? "md" : "sm";
  // До 640 кнопка во всю ширину: в две колонки они там не встают, а половинная кнопка под пальцем
  // читается как неактивная.
  const wide = "w-full justify-center sm:w-auto";
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
  // В лице призовой вынесен плиткой вправо — в строке фактов его не повторяем. Формат остаётся
  // в строке: это фраза («2 дивизиона, группа + плей-офф»), а не показатель, и в плитке он
  // набирается крупным жирным в шесть строк.
  const facts = [period(t), t.format, !face && t.prize && `призовой ${t.prize}`].filter(Boolean);
  const hasSeats = t.divisions.length > 0 && t.divisions.length <= MAX_DIVISION_CARDS;

  const head = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <TournamentStatus status={t.status} />
        {face && t.series && (
          <Chip className="max-w-[12rem] truncate" title={t.series}>
            {t.series}
          </Chip>
        )}
      </div>

      <div className="mt-3">
        <Heading level={3}>
          <Link href={`/tournaments/${t.slug}`} className="break-words hover:text-[var(--accent-ink)]">
            {t.name}
          </Link>
        </Heading>
      </div>

      {facts.length > 0 && (
        <p className="mt-1.5">
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
            <div className="mt-4">
              <Divisions t={t} wide />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            {t.prize && <StatTile label="Призовой" value={t.prize} />}
            <Actions t={t} block />
          </div>
        </Grid>
      </Card>
    );
  }

  return (
    <Card motion="lift">
      {head}
      {hasSeats && (
        <div className="mt-4">
          <Capacity taken={seats.taken} limit={seats.limit} />
        </div>
      )}
      <div className="mt-4">
        <Divisions t={t} wide={false} />
      </div>
      {t.description && (
        <p className="mt-3 line-clamp-2 text-sm font-bold leading-[1.55] text-muted">{t.description}</p>
      )}
      <div className="mt-4">
        <Actions t={t} block={false} />
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
      href={`/tournaments/${t.slug}`}
      className="block rounded-control focus-visible:outline-none focus-visible:[box-shadow:var(--sh-focus)]"
    >
      <RowCard>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {dates && <Text muted size="sm" num>{dates}</Text>}
            <span className="font-pouf font-black text-ink">{t.name}</span>
            {t.series && (
              <Chip className="max-w-[12rem] truncate" title={t.series}>
                {t.series}
              </Chip>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <TournamentStatus status={t.status} />
            {t.divisions.length > 0 && (
              <Capacity taken={seats.taken} limit={seats.limit} size="sm" meter={false} />
            )}
          </div>
        </div>
      </RowCard>
    </Link>
  );
}
