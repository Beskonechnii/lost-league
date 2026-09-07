import type { PermissionKey } from "@/lib/permissions";
import type { IconName } from "@/components/pouf/Icon";

// Реестр инструментов операторской — ОДИН на сайдбар и на плитки хаба /admin. Пока списка было два,
// новый инструмент попадал в одно место и не попадал в другое; теперь добавить его можно только
// здесь, а оба вида навигации получают его сами.
//
// Плитку и пункт показываем только при наличии права (ACCOUNTS-PLAN.md §5): не видно того, чем
// нельзя пользоваться. Это витрина, а не защита — сами разделы и пишущие роуты проверяют право у себя.

export type Tool = {
  href: string;
  perm: PermissionKey;
  label: string;
  /** Роль из словаря Кита (`pouf/Icon`), а не эмодзи: у эмодзи своя форма и цвет
   *  в каждой ОС, они не берут currentColor и дерутся с пастелью Light Clay. */
  icon: IconName;
  desc: string;
  /** «В разработке» — заглушка, держащая место в ряду. */
  soon?: boolean;
};

export type ToolGroup = { title: string; tools: Tool[] };

export const TOOL_GROUPS: ToolGroup[] = [
  {
    title: "Showmatch",
    tools: [
      { href: "/underbeer", perm: "underbeer", label: "UNDERBEER 2.0", icon: "flame", desc: "Шоу-драфт: капитаны по очереди собирают команды из ростера." },
      { href: "/admin/single-draft", perm: "tools", label: "single draft", icon: "wand", desc: "Случайный герой по каждой характеристике." },
      { href: "/admin/1x1", perm: "tools", label: "1х1", icon: "sword", desc: "Турнир 1х1.", soon: true },
      { href: "/admin/fearless-draft", perm: "tools", label: "fearless draft", icon: "off", desc: "Драфт героев без повторов по серии: баны, пики, fearless-пул." },
    ],
  },
  {
    title: "Модерация",
    tools: [
      { href: "/admin/tournaments", perm: "tournaments.edit", label: "Турниры", icon: "trophy", desc: "Завести турнир, описать его, раздать дивизионы и составы." },
      { href: "/admin/roster/import", perm: "tournaments.edit", label: "Импорт составов", icon: "database", desc: "Разобрать таблицу сезона в команды и игроков: файл, ссылка или текст — с превью и проверкой перед записью в дивизион или в общий ростер." },
      { href: "/admin/roster/crm-import", perm: "roster.edit", label: "Импорт CRM", icon: "mail", desc: "Дозаполнить анкеты игроков из выгрузки CRM: телеграм, дата рождения, город, account_id — с превью перед записью." },
      { href: "/admin/moderation", perm: "accounts.approve", label: "Модерация", icon: "log", desc: "Анкеты новых игроков и привязки к профилю: одобрить с заведением профиля или вернуть с причиной." },
      { href: "/admin/staff", perm: "accounts.admins", label: "Команда лиги", icon: "shield", desc: "Владелец и админы: назначение роли и раздача прав по галочкам." },
      { href: "/admin/tp", perm: "tp.edit", label: "TP", icon: "star", desc: "Начисление сезонных очков MVP игрокам." },
      { href: "/admin/bot", perm: "tournaments.edit", label: "Телеграм-бот", icon: "send", desc: "Разговор бота нодами: что он говорит, какие кнопки показывает и куда ведёт каждая. Рядом — тайминги напоминаний." },
      { href: "/admin/duplicates", perm: "roster.edit", label: "Дубли профилей", icon: "users", desc: "Похожие профили одного человека: объединить, переименовать или развести." },
      { href: "/admin/quizzes", perm: "quizzes", label: "Анкеты", icon: "comment", desc: "Опросы и записи на ивенты: бот собирает ответы в телеграме." },
    ],
  },
  {
    title: "Аналитика",
    tools: [
      { href: "/match", perm: "tools", label: "Разбор матча", icon: "chart", desc: "Постгейм-отчёт по ID матча из Dota 2." },
      { href: "/admin/vision", perm: "tools", label: "Варды", icon: "pin", desc: "Карта расстановки вардов команды по архиву." },
      { href: "/admin/stats", perm: "tools", label: "Показатели", icon: "performance", desc: "Топ-5 по каждой метрике: разрез дивизион / стадия / игроки или команды." },
    ],
  },
  {
    title: "Инструменты",
    tools: [
      { href: "/admin/series", perm: "series.edit", label: "Архив серий", icon: "history", desc: "Встречи турнира и карты в них — отсюда стата идёт в статистику." },
      { href: "/studio/editor", perm: "studio", label: "Студия", icon: "photo", desc: "Сборка турнирной графики по данным ростера." },
      { href: "/admin/theme", perm: "theme", label: "Тема", icon: "settings", desc: "Цвета UI проекта: акцент, поверхности, текст. Правится и едет в data/theme.json." },
    ],
  },
];

/** Инструмент, у которого есть индикатор очереди. */
export const QUEUE_TOOL = "/admin/moderation";
/** Инструмент, у которого есть индикатор похожих профилей. */
export const DUPLICATES_TOOL = "/admin/duplicates";

/** Группы, срезанные правами: пустые группы отбрасываем — заголовок без пунктов только мешает. */
export function toolGroupsFor(perms: PermissionKey[]): ToolGroup[] {
  return TOOL_GROUPS.map((g) => ({ title: g.title, tools: g.tools.filter((t) => perms.includes(t.perm)) })).filter(
    (g) => g.tools.length > 0,
  );
}
