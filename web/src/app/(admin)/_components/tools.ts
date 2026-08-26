import type { PermissionKey } from "@/lib/permissions";

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
  icon: string;
  desc: string;
  /** «В разработке» — заглушка, держащая место в ряду. */
  soon?: boolean;
};

export type ToolGroup = { title: string; tools: Tool[] };

export const TOOL_GROUPS: ToolGroup[] = [
  {
    title: "Showmatch",
    tools: [
      { href: "/underbeer", perm: "underbeer", label: "UNDERBEER 2.0", icon: "🍺", desc: "Шоу-драфт: капитаны по очереди собирают команды из ростера." },
      { href: "/admin/single-draft", perm: "tools", label: "single draft", icon: "🎲", desc: "Случайный герой по каждой характеристике." },
      { href: "/admin/1x1", perm: "tools", label: "1х1", icon: "🛠️", desc: "Турнир 1х1.", soon: true },
      { href: "/admin/fearless-draft", perm: "tools", label: "fearless draft", icon: "🚫", desc: "Драфт героев без повторов по серии: баны, пики, fearless-пул." },
    ],
  },
  {
    title: "Модерация",
    tools: [
      { href: "/admin/tournaments", perm: "tournaments.edit", label: "Турниры", icon: "🏟️", desc: "Завести турнир, описать его, раздать дивизионы и составы." },
      { href: "/admin/moderation", perm: "accounts.approve", label: "Модерация", icon: "📝", desc: "Анкеты новых игроков и привязки к профилю: одобрить с заведением профиля или вернуть с причиной." },
      { href: "/admin/staff", perm: "accounts.admins", label: "Команда лиги", icon: "🛡️", desc: "Владелец и админы: назначение роли и раздача прав по галочкам." },
      { href: "/admin/tp", perm: "tp.edit", label: "TP", icon: "🏅", desc: "Начисление сезонных очков MVP игрокам." },
      { href: "/admin/bot", perm: "tournaments.edit", label: "Бот заявок", icon: "🤖", desc: "Что телеграм-бот спрашивает у капитана: тексты шагов и свои вопросы." },
    ],
  },
  {
    title: "Аналитика",
    tools: [
      { href: "/match", perm: "tools", label: "Разбор матча", icon: "📊", desc: "Постгейм-отчёт по ID матча из Dota 2." },
      { href: "/admin/vision", perm: "tools", label: "Варды", icon: "👁️", desc: "Карта расстановки вардов команды по архиву." },
      { href: "/admin/stats", perm: "tools", label: "Показатели", icon: "📈", desc: "Топ-5 по каждой метрике: разрез дивизион / стадия / игроки или команды." },
    ],
  },
  {
    title: "Архив",
    tools: [
      { href: "/admin/series", perm: "series.edit", label: "Архив серий", icon: "🗂️", desc: "Встречи турнира и карты в них — отсюда стата идёт в статистику." },
    ],
  },
  {
    title: "Графика",
    tools: [
      { href: "/studio/editor", perm: "studio", label: "Студия", icon: "🎨", desc: "Сборка турнирной графики по данным ростера." },
    ],
  },
  {
    title: "UI",
    tools: [
      { href: "/admin/theme", perm: "theme", label: "Тема", icon: "🎛️", desc: "Цвета UI проекта: акцент, поверхности, текст. Правится и едет в data/theme.json." },
    ],
  },
];

/** Инструмент, у которого есть индикатор очереди. Пока такой один — модерация. */
export const QUEUE_TOOL = "/admin/moderation";

/** Группы, срезанные правами: пустые группы отбрасываем — заголовок без пунктов только мешает. */
export function toolGroupsFor(perms: PermissionKey[]): ToolGroup[] {
  return TOOL_GROUPS.map((g) => ({ title: g.title, tools: g.tools.filter((t) => perms.includes(t.perm)) })).filter(
    (g) => g.tools.length > 0,
  );
}
