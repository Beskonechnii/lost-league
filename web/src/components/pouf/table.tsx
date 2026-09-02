import type { ReactNode } from "react";
import { QUALIFICATION, type Qualification } from "@/lib/qualification";

/* Атомы турнирной таблицы — перенос артбордов Кита «Турнирная таблица» и
 * «Групповой этап» (Э5 RELEASE-PLAN). Здесь, а не на странице, потому что одни
 * и те же кирпичи рисуют три экрана: таблицу дивизиона, блоки групп и сетку
 * плей-офф, а завтра — карточку команды и расписание.
 *
 * Без "use client": атомы чистые, их тянет и серверная страница групп, и
 * клиентская таблица с сортировкой.
 *
 * Про третью ступень текста. В Ките шапка колонок и подписи строк набраны
 * `--sub` (#AEAAA0) — на бумаге это 1.81:1, то есть подпись, которую нельзя
 * прочитать. Поэтому на экранах турнирного блока третьей ступени не осталось
 * вовсе: всё, что видно глазом, живёт на ступень темнее (`--muted`, 3.24:1 на
 * бумаге). Кит при этом не правится — расхождение осознанное и записано в
 * WORKLOG Э5.
 */

/** Лого команды, а нет файла — монограмма из тега. Кит: `.tmark`. */
export function TeamMark({
  logo,
  tag,
  name,
  size = 34,
}: {
  logo?: string | null;
  tag: string;
  name?: string;
  size?: number;
}) {
  const box = { width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.34)) };
  return logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt=""
      title={name}
      style={box}
      className="shrink-0 rounded-[14px] bg-surface-1 object-contain p-[3px] cushion-row"
    />
  ) : (
    <span
      title={name}
      style={box}
      className="grid shrink-0 place-items-center rounded-[14px] bg-surface-1 font-black uppercase leading-none text-muted cushion-row"
    >
      {tag.slice(0, 2)}
    </span>
  );
}

/** Рейка зоны выхода слева от места. Кит: `.zbar` — градиент, а не плоский цвет. */
export function ZoneBar({ zone, height = 26 }: { zone: Qualification; height?: number }) {
  return (
    <span
      aria-hidden
      title={QUALIFICATION[zone].label}
      style={{ background: QUALIFICATION[zone].bar, height }}
      className="inline-block w-[7px] shrink-0 rounded-pill [box-shadow:0_0_0_1px_rgba(255,255,255,.35),inset_1px_1px_1px_rgba(255,255,255,.4),inset_-1px_-2px_2px_rgba(0,0,0,.22)]"
    />
  );
}

/**
 * Легенда зон — те же рейки, что и в строках. Набор зон приходит снаружи: в дивизионе без вылета
 * (D2) третьей зоны нет вовсе, и рисовать её «для полноты» значило бы объявить правило, которого
 * в этом дивизионе не существует.
 */
export function ZoneLegend({
  zones,
  height = 18,
  className = "",
}: {
  zones: readonly Qualification[];
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-5 gap-y-2 font-pouf text-[11px] font-extrabold text-muted ${className}`}
    >
      {zones.map((z) => (
        <span key={z} className="inline-flex items-center gap-2">
          <ZoneBar zone={z} height={height} />
          {QUALIFICATION[z].label}
        </span>
      ))}
    </div>
  );
}

/** Зоны дивизиона в порядке таблицы. Без вылета — две, с вылетом — три. */
export const zonesOf = (relegation: boolean) =>
  relegation ? (["upper", "lower", "out"] as const) : (["upper", "lower"] as const);

/** Плашка очков. `lead` — акцентная: первое место в группе. Кит: `.pts` / `.pts.lead`. */
export function Points({ children, lead = false }: { children: ReactNode; lead?: boolean }) {
  return (
    <span
      className={`inline-block min-w-[34px] rounded-pill px-3 py-[6px] text-center font-pouf font-black tabular-nums ${
        lead ? "bg-accent-fill text-[var(--on-accent)] cushion-blob" : "bg-surface-1 text-ink cushion-row"
      }`}
    >
      {children}
    </span>
  );
}

/** Разница карт: плюс — мятный ink, минус — кирпичный. Кит: `.tdiff.pos/.neg`. */
export function MapDiff({ won, lost }: { won: number; lost: number }) {
  const d = won - lost;
  return (
    <span
      title={`${won} : ${lost}`}
      className={`font-black tabular-nums ${
        d > 0 ? "text-[var(--accent-ink)]" : d < 0 ? "text-[var(--color-err-ink)]" : "text-muted"
      }`}
    >
      {d > 0 ? `+${d}` : d < 0 ? `−${Math.abs(d)}` : "0"}
    </span>
  );
}

/**
 * Форма: последние встречи, свежая справа. Кит: `.fdot.w/.l/.n`. Показываем ровно `size` клеток —
 * недостающие рисуются пустыми лунками, иначе ряд «прыгает» по ширине от строки к строке.
 */
export function FormDots({ form, size = 5 }: { form: ("w" | "l")[]; size?: number }) {
  const tail = form.slice(-size);
  const pad = Array.from({ length: Math.max(0, size - tail.length) }, () => null);
  return (
    <span className="flex justify-center gap-[5px]">
      {[...pad, ...tail].map((r, i) => (
        <span
          key={i}
          title={r === "w" ? "победа" : r === "l" ? "поражение" : "встреча не сыграна"}
          className={`grid h-[17px] w-[17px] place-items-center rounded-[7px] text-[10px] font-black ${
            r === "w"
              ? "bg-accent-fill text-[var(--on-accent)] cushion-blob"
              : r === "l"
                ? "bg-[linear-gradient(135deg,#F5D3D3,#E3A3A3)] text-[var(--color-err-ink)] cushion-row"
                : "bg-surface-2 text-muted cushion-field"
          }`}
        >
          {r === "w" ? "В" : r === "l" ? "П" : "—"}
        </span>
      ))}
    </span>
  );
}

/**
 * Клетка кросс-таблицы. Кит: `.cell` + `.w/.l/.soon/.self`. Счёт всегда глазами команды-строки.
 * `dim` — счёт восстановлен расчётом, а не прочитан из таблицы сезона: его ещё надо проверить руками.
 */
export function CrossCell({
  state,
  children,
  title,
  dim = false,
}: {
  state: "win" | "loss" | "soon" | "self";
  children: ReactNode;
  title?: string;
  dim?: boolean;
}) {
  const tone =
    state === "win"
      ? "bg-accent-fill text-[var(--on-accent)] cushion-blob"
      : state === "loss"
        ? "bg-[linear-gradient(135deg,#F7DCDC,#EDC0C0)] text-[var(--color-err-ink)] cushion-row"
        : state === "self"
          ? "bg-surface-3/60 text-muted cushion-field"
          : "bg-surface-2 text-muted cushion-field";
  return (
    <div
      title={title}
      className={`grid h-11 w-14 place-items-center rounded-[14px] font-pouf text-sm font-black tabular-nums ${tone} ${
        dim ? "opacity-60" : ""
      }`}
    >
      {children}
    </div>
  );
}
