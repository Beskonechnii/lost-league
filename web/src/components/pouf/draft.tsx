"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { Meter } from "./blocks";
import { Eyebrow } from "./text";

/* Атомы драфта лобби — артборды Кита «Драфт» (ТЗ 42, DESIGN-10).
 *
 * Отдельным файлом, а не по месту в `app/(public)/lobby`, потому что у каждого из них уже есть
 * второй потребитель — ОБС-вид (`(bare)/overlay/lobby/[key]`), а собранное по месту в
 * `admin/fearless-draft/_components` переиспользовать нельзя: это существующий долг того же рода,
 * что скорборд, и повторять его в лобби значит завести третью копию одной мысли.
 *
 * Про людей атомы не знают вовсе: аватар приезжает готовым узлом (`avatar`), потому что рисует
 * его ростер (`app/(public)/roster/_components/avatar`), а Кит из приложения не импортирует.
 *
 * Вид и состояния живут в `pouf.css` (секция DRAFT), а не утилитами по месту: пульс текущего хода,
 * появление героя и ленивое видео — это анимации и media-query, которые строкой классов не
 * выражаются, а числа ширин обязаны быть одни на борд и на ОБС.
 */

/** Герой глазами борда: портрет обязателен, ролик — нет (набор webm неполный по определению). */
export type DraftHero = { id: number; name: string; img: string; video: string | null };

/** Длительность броска, мс (DESIGN-4): 400 подлёт + 1600 вращение + 400 посадка. Живёт здесь,
 *  а не только в CSS, потому что по ней вкладка решает, играть анимацию или показать готовое. */
export const COIN_MS = 2400;

/**
 * Монетка. **Исход считает сервер** — атом только проигрывает уже известный результат, и его
 * длительность ни на что не влияет.
 *
 * `at` — отметка броска в часах ЭТОЙ вкладки (серверную сдвигает вызывающий, как часы хода):
 * все вкладки начинают вращение в одну секунду, а опоздавшая — открыли комнату после броска —
 * не играет его вовсе и показывает уже лежащую монетку. Проигравшей отдельного «вы проиграли»
 * нет: обе стороны видят одно и то же.
 */
export function CoinFlip({
  names,
  colors,
  winner,
  at,
}: {
  names: [string, string];
  /** Цвета сторон: лицевая грань монетки — сторона A, оборотная — B. */
  colors: [string, string];
  winner: 0 | 1;
  /** Когда бросили. null — отметки нет (комната завелась до 42в), показываем результат сразу. */
  at: number | null;
}) {
  // Разметка по умолчанию — уже лежащая монетка; анимацию включает эффект, прямо в DOM. Класс и
  // задержку нельзя посчитать в рендере: `Date.now()` на сервере и в браузере разный, и разметка
  // разошлась бы на гидрации. А писать их в состояние незачем — это ровно «внешняя система»,
  // которую эффекту и положено догонять.
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = box.current;
    if (node === null || at === null) return;
    const gone = Date.now() - at;
    // Опоздавшая вкладка (открыли после броска) анимацию не играет вовсе.
    if (gone < 0 || gone >= COIN_MS) return;
    // Отрицательная задержка — это «вступить в середину»: вкладка, открытая через секунду после
    // броска, досматривает ту же анимацию с того же места, а не начинает свою.
    node.style.setProperty("--pouf-coin-delay", `-${gone}ms`);
    node.classList.add("pouf-coin--play");
    return () => node.classList.remove("pouf-coin--play");
  }, [at]);

  return (
    <div
      ref={box}
      className="pouf-coin font-pouf"
      aria-live="polite"
      style={
        {
          // Восемь оборотов; победителю B добавляем полоборота, чтобы монетка легла его гранью.
          "--pouf-coin-turn": winner === 0 ? "2880deg" : "3060deg",
          "--pouf-coin-a": colors[0],
          "--pouf-coin-b": colors[1],
        } as CSSProperties
      }
    >
      {/* Подъём и вращение разнесены по двум узлам: у них разные кривые и разные окна времени,
          а одной анимацией на один элемент так не сказать. */}
      <div className="pouf-coin__toss">
        <div className="pouf-coin__disc">
          <span className="pouf-coin__face pouf-coin__face--a">{names[0].slice(0, 1).toUpperCase()}</span>
          <span className="pouf-coin__face pouf-coin__face--b">{names[1].slice(0, 1).toUpperCase()}</span>
        </div>
      </div>
      <p className="pouf-coin__plate">
        <b className="text-ink">{names[winner]}</b> выигрывает бросок
      </p>
    </div>
  );
}

/** Часы в эфире читают как «м:сс»: секундами никто не считает. */
export const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Слот пика или бана (DESIGN-2). Внутри — статичный PNG: шестнадцать роликов на эфирном борде
 * это шум и трафик, «живость» слоту дают его собственные состояния.
 *
 * Состояния — данными, а не классами снаружи: `data-filled`, `data-current`, `data-last` читает
 * CSS, и одно и то же состояние выглядит одинаково в комнате и в эфире. Появление героя
 * ключуется `key={hero.id}`: на прошлой карте (`past`) анимации нет вовсе — она уже сыграна.
 */
export function DraftSlot({
  n,
  hero,
  action,
  color,
  current = false,
  last = false,
  past = false,
}: {
  /** Сквозной номер хода по `SEQUENCE`, 1–16. В колонке он не пересчитывается. */
  n: number;
  hero?: DraftHero;
  action: "ban" | "pick";
  /** Цвет стороны — сырой hex: тот же, что горит в трансляции. */
  color?: string;
  /** Сейчас ходит эта сторона и это её текущий слот — единственный пульс на экране. */
  current?: boolean;
  /** Последний взятый пик: обводка без пульса. */
  last?: boolean;
  /** Прошлая карта: она не происходит, она уже сыграна — анимаций нет. */
  past?: boolean;
}) {
  return (
    <div
      className={`pouf-slot${action === "ban" ? " pouf-slot--ban" : ""}${past ? " pouf-slot--static" : ""}`}
      style={color ? ({ "--pouf-slot-color": color } as CSSProperties) : undefined}
      data-filled={hero ? "" : undefined}
      data-current={current ? "" : undefined}
      data-last={last ? "" : undefined}
      aria-current={current ? "step" : undefined}
      title={hero ? `${n}. ${hero.name}${action === "ban" ? " — бан" : ""}` : `Ход ${n}`}
    >
      {hero && (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={hero.id} src={hero.img} alt={hero.name} className="pouf-slot__img" />
      )}
      <span className="pouf-slot__n">{n}</span>
      {hero && <span className="pouf-slot__name">{hero.name}</span>}
      {hero && action === "ban" && <span className="pouf-slot__ban">Бан</span>}
    </div>
  );
}

/**
 * Колонка стороны (DESIGN-10.2): шапка, баны, пики. Ужатие по ширинам — в CSS: числа ширин одни
 * на комнату и на ОБС, и подбирать их дважды нельзя.
 *
 * Обводка «ходит эта сторона» обнимает всю колонку, а пульсирует внутри ровно один слот —
 * текущий: два разных приёма про одно и то же читались бы как рябь.
 */
export function DraftRail({
  name,
  color,
  sub,
  side,
  active = false,
  bans,
  picks,
  footer,
}: {
  name: string;
  color: string;
  /** Подпись под именем: «свет» / «тьма». */
  sub?: ReactNode;
  side: "left" | "right";
  active?: boolean;
  bans: ReactNode;
  picks: ReactNode;
  /** Подвал колонки — статус стороны и плашка капитана на узком экране. */
  footer?: ReactNode;
}) {
  return (
    <div
      className={`pouf-rail pouf-rail--${side} font-pouf`}
      style={{ "--pouf-slot-color": color } as CSSProperties}
      data-active={active ? "" : undefined}
    >
      <div className="pouf-rail__head">
        <span className="pouf-rail__dot" />
        <span className="pouf-rail__name">{name}</span>
        {sub && <span className="pouf-rail__sub">{sub}</span>}
      </div>
      <Eyebrow className="pouf-rail__label">Баны</Eyebrow>
      <div className="pouf-rail__bans">{bans}</div>
      <Eyebrow className="pouf-rail__label">Пики</Eyebrow>
      <div className="pouf-rail__picks">{picks}</div>
      {footer}
    </div>
  );
}

/**
 * Основной таймер (DESIGN-10.4). Он ОДИН на борд и переезжает к стороне хода — два циферблата по
 * краям нарушали бы «один таймер, переключается» визуально, даже если тикает один.
 *
 * Атом только рисует: секунды считает вызывающий по серверной отметке, а не часы этой машины.
 */
export function TurnClock({
  seconds,
  mode,
  align,
  name,
}: {
  seconds: number;
  /** `main` — основное время хода, `reserve` — пошёл банк, `idle` — ход не идёт. */
  mode: "main" | "reserve" | "idle";
  /** К какой стороне прижат циферблат. Переезд анимируется, см. `pouf.css`. */
  align: "start" | "end";
  /** Чей ход — подписью под числом. */
  name?: string;
}) {
  const urgent = mode !== "idle" && seconds < 10;
  return (
    <div className="pouf-clock font-pouf" data-align={align} data-mode={mode} data-urgent={urgent ? "" : undefined}>
      <div className="pouf-clock__value">{mode === "idle" ? "0:00" : fmtClock(seconds)}</div>
      <div className="pouf-clock__label">
        {mode === "idle" ? "карта задрафчена" : urgent ? "меньше 10 секунд" : mode === "reserve" ? "доп-время" : "ход"}
        {name && mode !== "idle" && <> · {name}</>}
      </div>
    </div>
  );
}

/**
 * Плашка капитана (DESIGN-10.5): кто ведёт сторону и сколько у неё осталось банка.
 *
 * Аватар приходит готовым узлом: рисовать людей — работа ростера, а Кит из приложения не
 * импортирует. Действие («отдать капитанство») тоже узлом: на стадии драфта его нет ни у кого,
 * и выдумывать серверное намерение ради кнопки атом не вправе.
 */
export function CaptainPlate({
  avatar,
  nickname,
  sideName,
  mine = false,
  reserveSec,
  reserveMax,
  align = "left",
  compact = false,
  action,
}: {
  avatar?: ReactNode;
  nickname: string | null;
  sideName: string;
  mine?: boolean;
  reserveSec: number;
  reserveMax: number;
  align?: "left" | "right";
  /** Узкий экран: банк числом, полоски нет. */
  compact?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className={`pouf-captain font-pouf${compact ? " pouf-captain--compact" : ""}`} data-align={align}>
      {avatar}
      <div className="pouf-captain__body">
        <div className="pouf-captain__who">{mine ? "Вы капитан" : `Капитан: ${sideName}`}</div>
        <div className="pouf-captain__nick">{nickname ?? "не назначен"}</div>
        {!compact && <Meter pct={(reserveSec / Math.max(1, reserveMax)) * 100} className="pouf-captain__meter" />}
      </div>
      <div className="pouf-captain__bank" title="Банк доп-времени">
        {fmtClock(reserveSec)}
      </div>
      {action}
    </div>
  );
}

/**
 * Плитка героя в пуле (DESIGN-10.3): PNG в покое, webm — только у того, с кем сейчас
 * взаимодействуют.
 *
 * Ролик едет не сразу: 120 мс удержания, иначе провод мышью через пул дёргает три десятка
 * запросов. Пока видео грузится, на экране стоит PNG — момента загрузки не видно вовсе, и ни
 * спиннера, ни «битой» рамки не нужно. Не приехало за 2000 мс — попытка прекращается.
 *
 * Играть одновременно может ровно один ролик: какой — решает родитель (`playing`), атом лишь
 * сообщает, что на нём задержались (`onHot`). Иначе вкладка держит десятки декодеров.
 */
export function DraftHeroButton({
  hero,
  state,
  note,
  big = false,
  playing = false,
  onHot,
  onPick,
  children,
}: {
  hero: DraftHero;
  /** `free` — можно взять · `chosen` — выбран, ждёт подтверждения · `view` — доступен, но нажать
   *  нельзя (смотрим) · `gone` — недоступен: забанен, взят, выбыл по fearless. */
  state: "free" | "chosen" | "view" | "gone";
  /** Подпись поверх недоступного: «в серии» / «занят». */
  note?: string;
  /** Крупная плитка — стадия назначения своего героя (42д). */
  big?: boolean;
  playing?: boolean;
  onHot?: (id: number | null) => void;
  onPick?: () => void;
  /** Поверх нижнего края — ник занявшего (42д). */
  children?: ReactNode;
}) {
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const give = useRef<ReturnType<typeof setTimeout> | null>(null);
  const video = useRef<HTMLVideoElement>(null);

  const drop = () => {
    if (hold.current) clearTimeout(hold.current);
    if (give.current) clearTimeout(give.current);
    hold.current = give.current = null;
  };

  // Выбранный герой играет и после ухода курсора (DESIGN-3), поэтому «остыл» шлём только из
  // покоя. Сам таймер и отказ живут в обработчиках: состояния у них нет — есть DOM и таймеры.
  const enter = () => {
    if (!onHot || hero.video === null || state === "gone") return;
    // Ни при `reduce`, ни в экономии трафика ролик не грузится вовсе.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if ((navigator as { connection?: { saveData?: boolean } }).connection?.saveData) return;
    drop();
    hold.current = setTimeout(() => {
      onHot(hero.id);
      give.current = setTimeout(() => {
        // `readyState < 3` — кадра всё ещё нет: бросаем попытку, PNG остаётся.
        if ((video.current?.readyState ?? 0) < 3) onHot(null);
      }, 2000);
    }, 120);
  };
  const leave = () => {
    drop();
    if (onHot && state !== "chosen") onHot(null);
  };

  const dead = state === "gone";
  return (
    <button
      type="button"
      className={`pouf-hero${big ? " pouf-hero--big" : ""}`}
      data-state={state}
      disabled={dead || state === "view"}
      aria-label={hero.name}
      title={note ? `${hero.name} — ${note}` : hero.name}
      onMouseEnter={enter}
      onFocus={enter}
      onMouseLeave={leave}
      onBlur={leave}
      onClick={onPick}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={hero.img} alt="" className="pouf-hero__img" />
      {playing && hero.video && (
        // Видео для скринридера не существует: подпись несёт сама кнопка, звука у рендеров нет.
        <video
          ref={video}
          className="pouf-hero__video"
          src={hero.video}
          muted
          loop
          playsInline
          autoPlay
          preload="none"
          aria-hidden
          // Проявление — в обработчике, а не состоянием: до `canplay` в кадре пусто, и любое
          // состояние здесь перерисовывало бы весь пул на каждый чих мыши.
          onCanPlay={(e) => {
            e.currentTarget.style.opacity = "1";
            // `autoplay` у только что вставленного узла срабатывает не всегда (вкладка в фоне,
            // политика автовоспроизведения), а отказ здесь — не ошибка: остаётся первый кадр.
            void e.currentTarget.play().catch(() => {});
          }}
        />
      )}
      {note && <span className="pouf-hero__note">{note}</span>}
      {children}
    </button>
  );
}
