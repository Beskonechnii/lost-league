import { IMMORTAL, rankDelta, rankLabel, rankParts } from "@/lib/dota-rank";

/* Медаль ранга Dota — артборд Кита из списка «чего не хватает» (`RELEASE-PLAN.md` §A).
 *
 * Ранг до Э20 жил в интерфейсе одной строкой текста («Властелин 5») в четырёх
 * местах сразу: факт-блок профиля, превью импорта, список заявок, витрина
 * ростера. Строку невозможно просканировать глазами — список из двадцати
 * игроков читается по слову, а не по картинке, — и она никак не показывает
 * движение, ради которого этап и делается.
 *
 * СВОЙ рисунок, а не иконки Valve. Медали Доты — их арт, вендорить его в
 * `public/assets` рядом с иконками героев нельзя: те приезжают из открытого
 * CDN констант и обновляются скриптом, а медали пришлось бы выдирать из
 * клиента игры. Поэтому знак собран из языка Кита: клеевая подушка тона
 * медали, светлое донце, римская цифра ступени и звёзды по нижней дуге —
 * ровно та композиция, по которой медаль узнают в игре, без чужой графики.
 *
 * Цифра, а не только цвет. Семь пастельных кружков различимы, пока стоят
 * рядом в ките; в таблице они идут по одному, и «это синий или бирюзовый?» —
 * не тот вопрос, на который оператор должен отвечать. Ступень написана
 * цифрой, WCAG 1.4.1 (цвет не единственный носитель смысла) выполняется без
 * подписи рядом.
 *
 * Без "use client": разметка чистая, её тянут и серверные страницы витрин.
 */

/** Тон медали: подушка (тёмная сторона), донце и цифра на нём. */
const TONES: Record<number, { disc: string; face: string; ink: string }> = {
  1: { disc: "#a9a291", face: "#ded9cc", ink: "#4a463c" }, // Рекрут — серый камень
  2: { disc: "#92c07f", face: "#d7ecc9", ink: "#2f5225" }, // Страж — зелень
  3: { disc: "#9db6cd", face: "#dde8f1", ink: "#2f4759" }, // Рыцарь — сталь
  4: { disc: "#86c1bd", face: "#d5ecea", ink: "#204a47" }, // Герой — бирюза
  5: { disc: "#b294d8", face: "#e6dbf4", ink: "#432b60" }, // Легенда — пурпур
  6: { disc: "#8aabdd", face: "#d9e5f7", ink: "#23406b" }, // Властелин — синь
  7: { disc: "#9fd2e6", face: "#e2f3fa", ink: "#124a5c" }, // Божество — лёд
  8: { disc: "#d9a94e", face: "#f6e6c2", ink: "#5e3f0c" }, // Иммортал — золото
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

export type RankSize = "sm" | "md" | "lg";
const PX: Record<RankSize, number> = { sm: 22, md: 30, lg: 44 };

/** Пятиконечная звезда точками — рисуем сами: тащить сюда иконочный пакет ради 4px глифа незачем. */
function starPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.44;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

/**
 * Знак ранга. Ранга нет (пусто, 0, мусор) — не рисуем ничего: прочерк в сетке
 * карточек хуже, чем отсутствие элемента.
 */
export function RankMedal({ tier, size = "md" }: { tier: number | null | undefined; size?: RankSize }) {
  const parts = rankParts(tier);
  if (!parts) return null;
  const tone = TONES[parts.medal] ?? TONES[1];
  const label = rankLabel(tier) ?? "";
  const px = PX[size];

  // Звёзды по нижней дуге, как на медали в игре: центр внизу (90°), шаг 26° — при более тесном
  // шаге пять звёзд Божества слипаются в сплошную гребёнку и перестают считываться поштучно.
  const stars: string[] = [];
  const step = 26;
  for (let i = 0; i < parts.star; i++) {
    const deg = 90 - ((parts.star - 1) / 2) * step + i * step;
    const a = (deg * Math.PI) / 180;
    stars.push(starPoints(22 + 16.5 * Math.cos(a), 22 + 16.5 * Math.sin(a), 2.8));
  }

  return (
    <span
      role="img"
      aria-label={`Ранг: ${label}`}
      title={label}
      // Тень нейтральная (`cushion-row`), а не мятная `cushion-blob`: подушка медали красится
      // в тон ступени — золото, пурпур, сталь, — и зелёный внутренний рефлекс на них врёт.
      className="inline-grid shrink-0 place-items-center rounded-pill cushion-row"
      style={{ background: tone.disc, width: px, height: px }}
    >
      <svg viewBox="0 0 44 44" width={px} height={px} aria-hidden="true">
        <circle cx="22" cy="22" r="13.2" fill={tone.face} />
        {parts.medal === IMMORTAL ? (
          // У Иммортала ступеней нет — вместо цифры ромб, как в игре у него нет и звёзд.
          <polygon points="22,13 29,22 22,31 15,22" fill={tone.ink} />
        ) : (
          <text
            x="22"
            y="22"
            textAnchor="middle"
            dominantBaseline="central"
            fill={tone.ink}
            fontSize={parts.medal >= 6 ? 12 : 15}
            fontWeight={900}
            fontFamily="var(--font-pouf)"
          >
            {ROMAN[parts.medal - 1]}
          </text>
        )}
        {stars.map((pts, i) => (
          <polygon key={i} points={pts} fill={tone.face} stroke={tone.ink} strokeWidth="0.6" strokeLinejoin="round" />
        ))}
      </svg>
    </span>
  );
}

/**
 * Стрелка изменения ранга: куда и на сколько звёзд. Показывается ТОЛЬКО когда
 * есть что показать — ранг не менялся или прошлого значения нет, элемента нет
 * вовсе. Ноль-дельта строкой «0» — шум, из-за которого перестают замечать
 * настоящие.
 *
 * Прошлое значение висит подсказкой, а не текстом: стрелка стоит в тесных
 * местах (ячейка таблицы, мета-строка карточки), и «было Властелин 3» рядом
 * с ней ломает строку. Там, где место есть, прошлый ранг рисует сам экран —
 * отдельной колонкой или второй строкой плитки.
 */
export function RankTrend({ tier, prev }: { tier: number | null | undefined; prev: number | null | undefined }) {
  const delta = rankDelta(tier, prev);
  if (!delta) return null;
  const up = delta.dir === "up";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill px-2 py-[2px] font-pouf text-[11px] font-extrabold tabular-nums ${
        up ? "bg-ok text-ok-ink" : "bg-err text-err-ink"
      }`}
      title={`было ${rankLabel(prev)}`}
    >
      <span aria-hidden="true">{up ? "\u25b2" : "\u25bc"}</span>
      {up ? "+" : "\u2212"}
      {delta.steps}
    </span>
  );
}

/**
 * Медаль с подписью — то, что стоит в строке таблицы. `prev` передан и ранг с
 * тех пор сменился — рядом встаёт стрелка.
 */
export function RankBadge({
  tier,
  prev,
  size = "md",
}: {
  tier: number | null | undefined;
  prev?: number | null;
  size?: RankSize;
}) {
  const label = rankLabel(tier);
  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-2 font-pouf">
      <RankMedal tier={tier} size={size} />
      <span className={`font-extrabold text-ink ${size === "sm" ? "text-xs" : "text-sm"}`}>{label}</span>
      <RankTrend tier={tier} prev={prev} />
    </span>
  );
}
