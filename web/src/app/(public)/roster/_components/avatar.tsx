import { teamTag } from "@/lib/profiles";

// Аватарка игрока. Фото есть далеко не у всех, поэтому заглушка — не серый квадрат,
// а инициалы ника на градиенте в цвет команды: страница выглядит целой и без единого кадра.

const ACCENT = "#a855f7"; // фирменный фиолетовый — цвет по умолчанию, если у команды свой не задан

/** Одна-две первых буквы ника. «B U R I Z A» → «BU», «300$» → «30», кириллица как есть. */
function initials(nickname: string): string {
  const letters = [...nickname].filter((ch) => /[\p{L}\p{N}]/u.test(ch));
  return letters.slice(0, 2).join("").toUpperCase() || "?";
}

export function PlayerAvatar({
  photo,
  nickname,
  color,
  size = 160,
  shape = "square",
  className = "",
}: {
  photo: string | null;
  nickname: string;
  color?: string | null;
  size?: number;
  /** Круглая — для рельса состава в профиле (Кит, артборд «Профиль · атомы»). */
  shape?: "square" | "circle";
  className?: string;
}) {
  const accent = color?.trim() || ACCENT;
  // Фото — вырезка на прозрачном фоне, поэтому подложка всегда фирменная: градиент в цвет команды.
  // Один и тот же градиент под фото и под инициалами — карточки выглядят единым набором.
  // Прозрачность цвета в hex-суффиксе: работает с любым значением из поля color.
  // Тёмный конец градиента — тот же цвет команды поплотнее, а не чёрный: на светлой бумаге Кита
  // почти-чёрный угол проступал вдоль скруглённого края тонкой тёмной линией и пачкал угол плитки.
  const background = `linear-gradient(150deg, ${accent}80, ${accent}1f 58%, ${accent}5c)`;

  return (
    <div
      // Рамки нет намеренно: `border-white/10` поверх тёмной подложки читался тонкой чёрной
      // линией по краю кадра — на светлой бумаге Кита именно она бросалась в глаза. Плитка и так
      // отделена от фона своей подложкой, обводка ей не нужна.
      className={`relative grid shrink-0 place-items-center overflow-hidden ${
        shape === "circle" ? "rounded-pill" : "rounded-2xl"
      } ${className}`}
      style={{ width: size, height: size, background }}
    >
      {photo ? (
        // Вырезка «по грудь» уже кадрирована квадратом и посажена к низу (scripts обрезки) —
        // object-bottom держит человека «стоящим» в рамке, если аватарка окажется не квадратной.
        // локальный файл из public/uploads — оптимизация next/image здесь не нужна
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={nickname} className="h-full w-full object-cover object-bottom" />
      ) : (
        <span
          // Тёмные инициалы на пастельной плитке: подложка теперь светлая по всей площади, и
          // белые буквы на ней тонули — тем же тёмным по пастели набраны чипы Кита.
          className="font-black tracking-tight text-ink/75"
          style={{ fontSize: Math.round(size * 0.34) }}
        >
          {initials(nickname)}
        </span>
      )}
    </div>
  );
}

/** Лого команды с текстовым фолбэком на тег — тем же, что печатается в таблицах. */
export function TeamLogo({
  team,
  size = 40,
  className = "",
}: {
  team: { name: string; tag?: string | null; logo: string | null };
  size?: number;
  className?: string;
}) {
  return (
    <div className={`grid shrink-0 place-items-center ${className}`} style={{ width: size, height: size }}>
      {team.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logo} alt={team.name} className="h-full w-full object-contain" />
      ) : (
        <span className="text-xs font-semibold text-ink-subtle">{teamTag(team)}</span>
      )}
    </div>
  );
}
