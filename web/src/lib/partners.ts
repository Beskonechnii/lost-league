// Партнёры-организаторы событий (Mix Cup by Eclipse, ТЗ 33). Отдельно от роутера ростера:
// это не команда лиги, а внешний клуб, и ассетов у него своя папка — public/assets/partners/.
//
// Ассеты присланы Стасом 23.09.2026. Берём горизонтальную версию: знак квадратный, и в строке
// высотой 28px его подпись нечитаема, а горизонтальная читается и в тулбаре, и на оверлее.
// Квадратная лежит рядом (eclipse-mark.svg) — под случай, когда понадобится крупный знак.
//
// Обе версии нарисованы на чёрной подложке под тёмный фон: внутри SVG свой `rect fill="black"`
// и белый текст. Поэтому PartnerMark не подкладывает под них светлую бумагу — иначе на карточке
// вышел бы чёрный квадрат в светлой рамке.
export const ECLIPSE_PARTNER = {
  name: "Eclipse",
  src: "/assets/partners/eclipse-wordmark.svg" as string | null,
  // Фон оверлея (решение Стаса 23.09.2026): картинка события ложится под карточки драфта.
  // Оверлей с ней перестаёт быть прозрачной накладкой — это отдельная сцена OBS, а не слой
  // поверх игры. Убрать фон — вернуть сюда null, вёрстка это переживает без правок.
  background: "/assets/partners/eclipse-overlay-bg.webp" as string | null,
};

/** Знак в нижней полосе эфирной сцены: файл плюс имя для alt. */
export type OverlayMark = {
  name: string;
  src: string;
  /** Цвет свечения вокруг знака; по умолчанию — белое, мягкое. */
  glow?: string;
};

/**
 * Знаки сцены Mix Cup (ТЗ 44) — данными, а не разметкой: состав меняется от события к событию,
 * и правка списка не должна быть правкой вёрстки. Иерархия местом, а не подписями (решение Стаса
 * 26.09.2026): платформа — в левом верхнем углу, организаторы — неподвижно в правом верхнем,
 * партнёры — бегущей строкой внизу. Стоящее в кадре читается хозяином, едущее — спонсорским блоком.
 *
 * Файлы — PNG с прозрачным фоном, высота 200px, знаки светлые под тёмную сцену Eclipse.
 * Пропорции у знаков разные, поэтому строка равняет их по ВЫСОТЕ, а ширину отдаёт файлу.
 */
export const OVERLAY_PLATFORM: OverlayMark = { name: "Spirit CTRL", src: "/assets/partners/spirit-ctrl.png" };

export const OVERLAY_ORGANIZERS: OverlayMark[] = [
  { name: "League of Spirits", src: "/assets/partners/league-of-spirits.png" },
  // Круг знака чёрный и на тёмном небе сливается в кляксу; оранжевое свечение в цвет его ободка
  // превращает его в затмение — тот же образ, что на фоне сцены.
  { name: "Eclipse", src: "/assets/partners/eclipse-logo.png", glow: "rgba(255, 90, 0, 0.9)" },
];

export const OVERLAY_PARTNERS: OverlayMark[] = [
  { name: "MKS", src: "/assets/partners/mks.png" },
  { name: "Brave", src: "/assets/partners/brave.png" },
  { name: "NetBox", src: "/assets/partners/netbox.png" },
  { name: "Gorilla", src: "/assets/partners/gorilla.png" },
];
