import { Meter } from "./blocks";
import {
  SHARD_GRADES,
  shardGrade,
  shardProgress,
  type ShardGrade,
} from "@/lib/shard-grades";

/* Осколки — знак валюты, ступень и лестница. Артборд Кита «Осколки» (`RELEASE-PLAN.md` §A).
 *
 * Осколки заводятся на Э22 сразу с графикой, потому что число без знака не читается как валюта:
 * «125» в факт-блоке профиля стоит рядом с MMR и TP и от них не отличается ничем. Знак нужен
 * ровно затем, чтобы взгляд отделял «за игру» (TP) от «за участие в жизни лиги» (осколки).
 *
 * СВОЙ рисунок из языка Кита, как у медали ранга: гранёный кристалл — тёмная подушка тона ступени,
 * светлая верхняя грань, тонкий контур. Иконочный пакет ради одного глифа не тянем.
 *
 * Ступень — ЦВЕТ ПЛЮС ИМЯ, и имя обязательно. Шесть пастельных кристаллов различимы, пока стоят
 * рядом в ките; поодиночке «это сирень или лёд?» — не тот вопрос, на который должен отвечать
 * человек. WCAG 1.4.1: цвет не единственный носитель смысла.
 *
 * Графика статистики (столбчатая, линейная) здесь НЕ нужна и в §A остаётся долгом: у осколков
 * витрина показывает одно число и путь до следующей ступени, а это полоса — китовый `Meter`,
 * а не график.
 *
 * Без "use client": разметка чистая, её тянут серверные страницы витрин.
 */

export type ShardSize = "sm" | "md" | "lg";
const PX: Record<ShardSize, number> = { sm: 18, md: 26, lg: 40 };

/** Кристалл в тоне ступени. Сам по себе — знак валюты, в цвете ступени — знак грейда. */
export function ShardGlyph({ grade, size = "md" }: { grade: ShardGrade; size?: ShardSize }) {
  const px = PX[size];
  return (
    <svg viewBox="0 0 44 44" width={px} height={px} aria-hidden="true" className="shrink-0">
      {/* Тело кристалла: ромб с вытянутым низом — так он не путается с ромбом Иммортала в медали ранга. */}
      <polygon points="22,3 36,17 22,41 8,17" fill={grade.tone.disc} />
      {/* Верхняя грань светлее — свет падает сверху, как у всех подушек Кита. */}
      <polygon points="22,3 36,17 22,21 8,17" fill={grade.tone.face} />
      {/* Рёбра: тонкие линии тоном надписи, иначе на светлом фоне грань теряется. */}
      <polyline points="8,17 22,21 36,17" fill="none" stroke={grade.tone.ink} strokeWidth="1.1" opacity="0.45" />
      <polyline points="22,3 22,21" fill="none" stroke={grade.tone.ink} strokeWidth="1.1" opacity="0.3" />
      <polygon
        points="22,3 36,17 22,41 8,17"
        fill="none"
        stroke={grade.tone.ink}
        strokeWidth="1.4"
        strokeLinejoin="round"
        opacity="0.55"
      />
    </svg>
  );
}

/**
 * Число осколков со знаком — то, что стоит в строке начисления и в факт-блоке профиля.
 * Тон берётся у ступени, на которой человек стоит: цифра и статус тогда читаются одним взглядом.
 */
export function ShardAmount({
  amount,
  earned,
  size = "sm",
  sign = false,
}: {
  amount: number;
  /** Заработано всего — от него тон. Не передан: тон первой ступени, нейтральный. */
  earned?: number;
  size?: ShardSize;
  /** Показать «+» — в списке начислений это приход, а не итог. */
  sign?: boolean;
}) {
  const grade = shardGrade(earned ?? 0);
  return (
    <span className="inline-flex items-center gap-1.5 font-pouf tabular-nums">
      <ShardGlyph grade={grade} size={size} />
      <span className={`font-black text-ink ${size === "lg" ? "text-2xl" : size === "md" ? "text-base" : "text-sm"}`}>
        {sign && amount > 0 ? "+" : ""}
        {amount}
      </span>
    </span>
  );
}

/** Знак ступени: кристалл в её тоне и имя. Это и есть «грейд» на витринах. */
export function ShardGradeBadge({ earned, size = "sm" }: { earned: number; size?: ShardSize }) {
  const grade = shardGrade(earned);
  return (
    <span
      className="inline-flex items-center gap-2 rounded-pill py-1 pl-1.5 pr-3 font-pouf cushion-row"
      style={{ background: grade.tone.face }}
      title={`Ступень ${grade.level} из ${SHARD_GRADES.length}`}
    >
      <ShardGlyph grade={grade} size={size} />
      <span className="text-[13px] font-black" style={{ color: grade.tone.ink }}>
        {grade.name}
      </span>
    </span>
  );
}

/**
 * Путь до следующей ступени: полоса и подпись «до Кристалла ещё 125». На вершине лестницы —
 * заполненная полоса и честное «выше ступеней нет», а не вечные 87% в никуда.
 */
export function ShardBar({ earned }: { earned: number }) {
  const { pct, left, next } = shardProgress(earned);
  return (
    <div className="font-pouf">
      <Meter pct={pct} />
      <div className="mt-1.5 flex items-baseline justify-between gap-2 text-[11px] font-extrabold text-muted">
        <span>{next ? `до ступени «${next.name}»` : "выше ступеней нет"}</span>
        {next && <span className="tabular-nums text-ink-subtle">ещё {left}</span>}
      </div>
    </div>
  );
}

/**
 * Лестница целиком — что впереди. Стоит на витрине вместо объяснений: список ступеней с порогами
 * отвечает на «а зачем они мне» лучше абзаца текста. Взятые подсвечены, будущие приглушены.
 */
export function ShardLadder({ earned }: { earned: number }) {
  const here = shardGrade(earned).level;
  return (
    <ul className="flex flex-wrap gap-1.5 font-pouf">
      {SHARD_GRADES.map((g) => {
        const taken = g.level <= here;
        return (
          <li
            key={g.level}
            className={`inline-flex items-center gap-1.5 rounded-pill px-2 py-1 text-[11px] font-extrabold tabular-nums ${
              taken ? "cushion-row" : "bg-surface-2 text-ink-subtle"
            }`}
            style={taken ? { background: g.tone.face, color: g.tone.ink } : undefined}
            title={`${g.name} — от ${g.from}`}
          >
            {/* Будущая ступень гасится целиком, вместе со знаком: цветной кристалл рядом с
                приглушённой подписью читается как «уже взято». */}
            <span className={taken ? "" : "opacity-40"}>
              <ShardGlyph grade={g} size="sm" />
            </span>
            {g.name}
            <span className={taken ? "opacity-60" : ""}>{g.from}</span>
          </li>
        );
      })}
    </ul>
  );
}
