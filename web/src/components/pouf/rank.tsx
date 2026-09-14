import Image from "next/image";

import { rankMedalUrls } from "@/lib/assets";
import { rankDelta, rankLabel, rankParts } from "@/lib/dota-rank";

/* Медаль ранга Dota — атом Кита.
 *
 * Ранг до Э20 жил в интерфейсе одной строкой текста («Властелин 5») в четырёх
 * местах сразу: факт-блок профиля, превью импорта, список заявок, витрина
 * ростера. Строку невозможно просканировать глазами — список из двадцати
 * игроков читается по слову, а не по картинке.
 *
 * Настоящие ассеты OpenDota, а не свой рисунок (решение 13.09, отменяет 10.09):
 * медаль должна узнаваться тем же знаком, что в клиенте игры, а свой знак
 * читался как «кружок с цифрой». Файлы лежат у нас в `public/uploads/ranks`,
 * хотлинка на чужой CDN нет ни основным путём, ни запасным.
 *
 * Композиция — два слоя в одном квадрате, без единого сдвига: подложка и
 * накладка звёзд нарисованы источником на одном холсте 256×256 в одной системе
 * координат. Поэтому звёзды не выходят за габарит конструктивно; задать им свой
 * размер или выровнять по центру — сломать регистрацию.
 *
 * Подушки под медалью нет: круг обрезал бы крылья Божества и низ плашки
 * Иммортала, а подушка Кита — знак «это наш объект», которым медаль Valve не
 * является. Чужой арт показывается как есть, ровно как иконки героев.
 *
 * `next/image`, а не голый `<img>`: исходники 256px, а слот 22–44, и на витрине
 * ростера это ~466 КБ PNG ради знаков по 22px. Оптимизатор отдаёт webp ближайшей
 * ступени. В серверном компоненте работает — без "use client" атом остаётся,
 * его тянут серверные страницы витрин.
 */

export type RankSize = "sm" | "md" | "lg";
const PX: Record<RankSize, number> = { sm: 22, md: 30, lg: 44 };

/**
 * Знак ранга. Ранга нет (пусто, 0, мусор) — не рисуем ничего: прочерк в сетке
 * карточек хуже, чем отсутствие элемента.
 */
export function RankMedal({ tier, size = "md" }: { tier: number | null | undefined; size?: RankSize }) {
  const parts = rankParts(tier);
  if (!parts) return null;
  const label = rankLabel(tier) ?? "";
  const px = PX[size];
  const src = rankMedalUrls(parts.medal, parts.star);

  return (
    // Доступное имя одно и на обёртке: у слоёв внутри `alt=""`, иначе скринридер прочитает ранг
    // дважды, а alt-текст сломанной картинки расползётся по строке. Файла нет — габарит всё равно
    // держат width/height, раскладка не прыгает (Chrome при этом рисует свой значок 22px).
    <span
      role="img"
      aria-label={`Ранг: ${label}`}
      title={label}
      className="relative inline-block shrink-0"
      style={{ width: px, height: px }}
    >
      <Image src={src.icon} alt="" width={px} height={px} className="absolute inset-0" />
      {src.star && <Image src={src.star} alt="" width={px} height={px} className="absolute inset-0" />}
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
