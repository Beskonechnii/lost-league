// Реестр гранулярных прав админа — чистый модуль (без БД и next/headers), как roles.ts: его можно
// импортировать хоть на клиенте, чтобы рисовать чекбоксы в панели команды лиги.
//
// Зачем права поверх ролей. Роль — грубый гейт: proxy пускает owner/admin в служебную часть целиком.
// Но админы разные: один принимает регистрации, другой ведёт архив серий, а тратить деньги в студии
// или удалять профили не должен ни тот, ни другой. Поэтому доступ к конкретному разделу решает право,
// а не роль. Серверные гарды (`can`/`requirePermission`) живут в account.ts: они читают БД, а сюда
// БД тянуть нельзя — модуль должен оставаться чистым.
//
// В БД (UserAccount.permissions) хранится строка ключей через запятую — как Player.tags: sqlite не
// умеет массивы, а заводить таблицу ради десятка флагов не стоит.

import type { Role } from "./player-auth"; // только тип — при сборке стирается, рантайм не тянется

export const PERMISSIONS = [
  {
    key: "accounts.approve",
    label: "Приём регистраций",
    group: "Аккаунты",
    hint: "Одобрять и отклонять новые анкеты и заявки на привязку к профилю",
  },
  {
    key: "accounts.admins",
    label: "Назначение админов",
    group: "Аккаунты",
    hint: "Выдавать роль админа и раздавать права. У владельца есть всегда",
  },
  { key: "roster.edit", label: "Правка ростера", group: "Ростер", hint: "Команды, игроки, составы" },
  {
    key: "roster.delete",
    label: "Удаление профилей",
    group: "Ростер",
    hint: "Отдельно от правки: действие разрушительное и необратимое",
  },
  {
    key: "tournaments.edit",
    label: "Турниры",
    group: "Турнир",
    hint: "Заводить турниры и дивизионы, принимать заявки команд",
  },
  { key: "series.edit", label: "Архив серий", group: "Турнир", hint: "Встречи, карты, результаты" },
  { key: "tp.edit", label: "Начисление TP", group: "Турнир", hint: "Сезонный зачёт очков MVP" },
  {
    key: "quizzes",
    label: "Анкеты",
    group: "Инструменты",
    hint: "Опросы и записи на ивенты, которые бот собирает в телеграме",
  },
  { key: "studio", label: "Студия графики", group: "Инструменты", hint: "В том числе платная генерация картинок" },
  { key: "underbeer", label: "UNDERBEER", group: "Инструменты", hint: "Шоу-драфт и его оверлей" },
  { key: "theme", label: "Тема UI", group: "Инструменты", hint: "Цвета интерфейса сайта" },
  { key: "tools", label: "Разбор матчей", group: "Инструменты", hint: "Постгейм, карта вардов, показатели" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

const KEYS = new Set<string>(PERMISSIONS.map((p) => p.key));

export const isPermissionKey = (v: string): v is PermissionKey => KEYS.has(v);

export const permissionLabel = (key: string): string =>
  PERMISSIONS.find((p) => p.key === key)?.label ?? key;

/** Группы в порядке объявления реестра — им же рисуется форма прав. */
export const PERMISSION_GROUPS = [...new Set(PERMISSIONS.map((p) => p.group))];

/** Строка из БД → список известных ключей. Неизвестные молча отбрасываем: право могли переименовать. */
export function parsePermissions(raw: string | null | undefined): PermissionKey[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(isPermissionKey);
}

/** Список ключей → строка для БД. Пусто → null: «прав нет» и «поле не заполняли» — одно и то же. */
export function formatPermissions(keys: readonly string[]): string | null {
  const clean = PERMISSIONS.filter((p) => keys.includes(p.key)).map((p) => p.key); // порядок реестра
  return clean.length ? clean.join(",") : null;
}

/** Права аккаунта: у владельца — все и неотчуждаемо, у игрока — никаких, у админа — что выдали. */
export function permissionsOf(role: Role, raw: string | null | undefined): PermissionKey[] {
  if (role === "owner") return PERMISSIONS.map((p) => p.key);
  if (role !== "admin") return [];
  return parsePermissions(raw);
}

/** Есть ли конкретное право. Чистая проверка — источник роли и строки прав даёт вызывающий. */
export function hasPermission(role: Role, raw: string | null | undefined, key: PermissionKey): boolean {
  if (role === "owner") return true;
  if (role !== "admin") return false;
  return parsePermissions(raw).includes(key);
}
