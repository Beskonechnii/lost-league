// Список экранов для листа контрольных кадров (`scripts/screen-sheet.ts`, ТЗ 46).
//
// Это КОНФИГ: чтобы добавить экран в лист, правится только этот файл, логика скрипта — нет.
// Порядок строк = порядок кадров в листе, поэтому держим его по смыслу: продукт → личное →
// служебное → эфир.
//
// `name` — ключ для `--only=<name>`, короткий и без пробелов.
// `widths` — ширины кадра в точках. 390 — телефон, 1280 — ноутбук, 1440 — рабочий стол.
//   Три ширины держим там, где раскладка на 1280 реально другая; остальным хватает 390 + 1440,
//   иначе лист растёт вдвое ради одинаковых кадров.
// `auth: true` — экран за входом, снимается сессией DEV_LOGIN_EMAIL.
// `fullPage: false` + `height` — кадр фиксированного размера (эфирная сцена 1920×1080).
//
// Адреса с id и слагами указываем конкретные: лист снимает URL, угадывать «любой турнир»
// он не умеет. Данные локальной базы поменялись — правим строку здесь.

export type ScreenSpec = {
  name: string;
  /** Адрес от корня сайта, вместе с ведущим слешем. */
  path: string;
  widths: number[];
  auth?: boolean;
  /** По умолчанию снимаем страницу целиком (до `maxHeight`); у эфирных сцен — ровно вьюпорт. */
  fullPage?: boolean;
  height?: number;
  /** Предел высоты длинного кадра, точки. */
  maxHeight?: number;
};

export const SCREENS: ScreenSpec[] = [
  { name: "home", path: "/", widths: [390, 1280, 1440] },
  { name: "tournaments", path: "/tournaments", widths: [390, 1440] },
  { name: "roster", path: "/roster", widths: [390, 1440] },
  { name: "players", path: "/players", widths: [390, 1440] },
  { name: "player", path: "/players/bsk", widths: [390, 1440] },
  { name: "series", path: "/series", widths: [390, 1440] },
  { name: "me", path: "/me", widths: [390, 1440], auth: true },
  { name: "admin", path: "/admin", widths: [390, 1440], auth: true },
  { name: "overlay-mixcup", path: "/overlay/draft/42", widths: [1920], fullPage: false, height: 1080 },
];
