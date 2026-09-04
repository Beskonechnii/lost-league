import type { ReactNode } from "react";
import Link from "next/link";
import { TeamMark } from "./table";

/* Карточка встречи — перенос артборда Кита «Карточка встречи» (Э6 RELEASE-PLAN).
 *
 * Кит называет её самым повторяемым элементом продукта: расписание, страница
 * дивизиона, профиль команды, шапка самой встречи. Поэтому она живёт здесь, а не
 * на странице: четыре состояния (предстоящая / live / сыграна / предложено время)
 * должны выглядеть одинаково везде. Вторая форма артборда — строка расписания
 * игрового дня — ещё не перенесена: её единственный потребитель, `/tp`, едет на Э8.
 *
 * Без "use client": карточка — чистая разметка, её тянут серверные страницы.
 *
 * Про третью ступень текста. В Ките верхняя строка карточки, тег команды и счёт
 * проигравшего набраны `--sub` (#AEAAA0, 1.81:1 на бумаге). Здесь всё это стоит
 * на ступень темнее (`--muted`) — то же решение, что на турнирном блоке Э5.
 * Сама `--muted` затемнена 04.09 до AA (DECISIONS.md).
 */

export type SeriesCardTeam = {
  name: string;
  tag?: string | null;
  logo?: string | null;
  /** Ссылка на карточку команды. Нет — сторона просто не кликается (соперник вне ростера). */
  href?: string;
};

/** Лунка счёта: Кит `.sscore`. Проигравший погашен, счёт под вопросом — весь блок приглушён. */
export function ScoreWell({
  home,
  away,
  winner,
  big = false,
  dim = false,
}: {
  home: number;
  away: number;
  winner: "home" | "away" | null;
  /** Шапка страницы встречи — там счёт крупнее, чем в списке карточек. */
  big?: boolean;
  dim?: boolean;
}) {
  // На узком экране лунка ужимается до 72–84px — цифры едут следом, иначе счёт в неё не влезает.
  const digit = big ? "text-[26px] sm:text-[34px]" : "text-[22px] sm:text-[26px]";
  const lose = "text-muted";
  return (
    <div
      title={dim ? "Счёт восстановлен расчётом — его ещё надо проверить" : undefined}
      className={`flex items-center justify-center gap-2 rounded-control bg-surface-2 py-2.5 font-pouf tabular-nums cushion-field ${
        dim ? "opacity-70" : ""
      }`}
    >
      <b className={`${digit} font-black leading-none tracking-[-1px] ${winner === "away" ? lose : "text-ink"}`}>{home}</b>
      <span className="font-black text-muted">:</span>
      <b className={`${digit} font-black leading-none tracking-[-1px] ${winner === "home" ? lose : "text-ink"}`}>{away}</b>
    </div>
  );
}

/** Та же лунка, но вместо счёта — время, «BO3» или прочерк. Кит: `.sscore.soon`. */
export function InfoWell({ children, big = false }: { children: ReactNode; big?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center gap-2 rounded-control bg-surface-2 py-2.5 text-center font-pouf font-black tracking-[-0.2px] text-muted tabular-nums cushion-field ${
        big ? "text-lg" : "text-[15px]"
      }`}
    >
      {children}
    </div>
  );
}

/** Одна карта серии: исход глазами стороны и, если карта разобрана, адрес её отчёта. */
export type MapPill = { result: "w" | "l" | null; href?: string };

/** Карты серии: выигранная — мятная, остальные — лунки. Кит: `.maps`/`.map`.
 *  Разобранная карта — ссылка на отчёт: до Э7 номер карты рисовался статикой, и с витрины
 *  к разбору вёл только «Отчёт» справа, хотя палец сам тянется к номеру. */
export function MapPills({ maps }: { maps: MapPill[] }) {
  if (maps.length === 0) return null;
  return (
    <span className="flex gap-1.5">
      {maps.map((m, i) => {
        const title = m.result === "w" ? `карта ${i + 1} — выиграна` : m.result === "l" ? `карта ${i + 1} — проиграна` : `карта ${i + 1} — не сыграна`;
        const cls = `grid h-[26px] min-w-[34px] place-items-center rounded-[10px] px-1.5 text-[11px] font-black ${
          m.result === "w" ? "bg-accent-fill text-[var(--on-accent)] cushion-blob" : "bg-surface-2 text-muted cushion-field"
        }`;
        return m.href ? (
          <Link
            key={i}
            href={m.href}
            title={`${title} · открыть отчёт`}
            className={`${cls} transition-transform hover:-translate-y-px active:translate-y-0`}
          >
            {i + 1}
          </Link>
        ) : (
          <span key={i} title={title} className={cls}>
            {i + 1}
          </span>
        );
      })}
    </span>
  );
}

/** Пульсирующая точка «идёт сейчас». Кит: `.livedot`. */
export function LiveDot() {
  return (
    <span className="inline-block h-[9px] w-[9px] shrink-0 rounded-pill bg-[linear-gradient(135deg,#F0A0A0,#D06B6B)] [box-shadow:0_0_0_3px_rgba(208,107,107,.18)]" />
  );
}

/**
 * Половина карточки: герб, название, тег. `mirror` — правая сторона, читается справа налево.
 *
 * На узком экране герб уезжает НАД названием, а не встаёт рядом. Это расхождение с Китом
 * (там мобильная карточка держит герб сбоку) и оно вынужденное: в макете карточка живёт на
 * 358px, а у нас на 375px рядом стоит рельс сайдбара, и на имя остаётся ~11px — читается
 * одна буква с многоточием. Столбиком имя получает всю колонку и укладывается в две строки.
 */
function TeamSide({
  team,
  mirror,
  markSize,
  nameClass,
}: {
  team: SeriesCardTeam;
  mirror: boolean;
  markSize: number;
  nameClass: string;
}) {
  const body = (
    <>
      <TeamMark logo={team.logo} tag={team.tag ?? team.name} name={team.name} size={markSize} />
      <span className="min-w-0 max-sm:w-full">
        <span
          // На узком экране имя переносится по словам и длинным словам, а не обрезается:
          // обрезка в колонке шириной ~80px оставляла от названия один слог.
          className={`block font-black tracking-[-0.3px] text-ink transition-colors [overflow-wrap:anywhere] group-hover:text-[var(--accent-ink)] sm:truncate sm:[overflow-wrap:normal] ${nameClass}`}
        >
          {team.name}
        </span>
        {team.tag && (
          <span className="block truncate text-[11px] font-extrabold uppercase tracking-[0.6px] text-muted">{team.tag}</span>
        )}
      </span>
    </>
  );
  const cls = `group flex min-w-0 flex-col items-center gap-1.5 text-center font-pouf sm:flex-row sm:items-center sm:gap-3 sm:text-left ${
    mirror ? "sm:flex-row-reverse sm:text-right" : ""
  }`;
  return team.href ? (
    <Link href={team.href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * Карточка встречи целиком. Верх — разрез и дата, тело — команда · счёт · команда,
 * низ (необязательный) — карты слева и действие справа.
 */
export function SeriesCard({
  badge,
  cut,
  aside,
  home,
  away,
  center,
  foot,
  action,
  big = false,
}: {
  /** Левая метка верхней строки: «BO3», «LIVE» — уже готовый чип. */
  badge?: ReactNode;
  /** Разрез: «Дивизион A · тур 7», «Верхняя сетка · Полуфинал». */
  cut?: ReactNode;
  /** Правый угол верхней строки: дата, «карта 2», «перенос». */
  aside?: ReactNode;
  home: SeriesCardTeam;
  away: SeriesCardTeam;
  /** Середина: `ScoreWell` или `InfoWell`. */
  center: ReactNode;
  /** Низ слева: карты, предупреждение о переносе. */
  foot?: ReactNode;
  /** Низ справа: кнопка или ссылка. */
  action?: ReactNode;
  /** Шапка страницы встречи: крупнее гербы и имена. */
  big?: boolean;
}) {
  return (
    <section className="rounded-card bg-surface px-5 py-5 font-pouf cushion-card">
      {(badge || cut || aside) && (
        <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-extrabold uppercase tracking-[1px] text-muted">
          {badge}
          {cut && <span className="min-w-0 truncate">{cut}</span>}
          {aside && <span className="ml-auto shrink-0">{aside}</span>}
        </div>
      )}

      {/* Три колонки: команда · лунка счёта · команда. Середина фиксирована, иначе счёт
          гуляет по горизонтали от строки к строке и колонки команд перестают совпадать. */}
      <div
        className={`mt-4 grid items-center gap-2 sm:gap-3 ${
          big ? "grid-cols-[1fr_84px_1fr] sm:grid-cols-[1fr_150px_1fr]" : "grid-cols-[1fr_72px_1fr] sm:grid-cols-[1fr_118px_1fr]"
        }`}
      >
        <TeamSide
          team={home}
          mirror={false}
          markSize={big ? 56 : 44}
          nameClass={big ? "text-base sm:text-2xl" : "text-[15px] sm:text-[17px]"}
        />
        {center}
        <TeamSide
          team={away}
          mirror
          markSize={big ? 56 : 44}
          nameClass={big ? "text-base sm:text-2xl" : "text-[15px] sm:text-[17px]"}
        />
      </div>

      {(foot || action) && (
        <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-hairline pt-3.5 text-xs font-extrabold text-muted">
          {foot}
          {action && <span className="ml-auto shrink-0">{action}</span>}
        </div>
      )}
    </section>
  );
}
