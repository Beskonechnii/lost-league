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

export type ToolGroup = {
  /** Сегмент адреса группы: `/admin/<slug>`. Не совпадает с сегментом инструмента —
   *  иначе статический маршрут инструмента перекрыл бы страницу группы. Проверяется
   *  при добавлении строки в реестр. */
  slug: string;
  title: string;
  /** Значок группы — из словаря Кита, как у инструментов: эмодзи здесь тоже нет. */
  icon: IconName;
  /** Одна фраза о группе для карточки на хабе. */
  desc: string;
  tools: Tool[];
};

export const TOOL_GROUPS: ToolGroup[] = [
  {
    slug: "showmatch",
    title: "Showmatch",
    icon: "flame",
    desc: "Шоу-форматы лиги: драфты капитанов, fearless и случайные герои.",
    tools: [
      { href: "/underbeer", perm: "underbeer", label: "UNDERBEER 2.0", icon: "flame", desc: "Шоу-драфт: капитаны по очереди собирают команды из ростера." },
      { href: "/admin/mixcup", perm: "mixcup", label: "Mix Cup by Eclipse", icon: "flame", desc: "Микс-драфт с тумблерами правил (украсть/закрепить) — результат сохраняется." },
      { href: "/admin/single-draft", perm: "tools", label: "single draft", icon: "wand", desc: "Случайный герой по каждой характеристике." },
      { href: "/admin/1x1", perm: "tools", label: "1х1", icon: "sword", desc: "Турнир 1х1.", soon: true },
      { href: "/admin/fearless-draft", perm: "tools", label: "fearless draft", icon: "off", desc: "Драфт героев без повторов по серии: баны, пики, fearless-пул." },
    ],
  },
  {
    // «Модерация» переименована в «Ведение лиги» (ТЗ 27): группа стала экраном, и крошки
    // вышли бы «Админ / Модерация / Модерация» — одно слово на две ступени. Состав не менялся.
    slug: "league",
    title: "Ведение лиги",
    icon: "shield",
    desc: "Турниры, составы, анкеты и права: всё, чем данные лиги заводятся и правятся.",
    tools: [
      { href: "/admin/tournaments", perm: "tournaments.edit", label: "Управление турнирами", icon: "trophy", desc: "Завести турнир, описать его, раздать дивизионы и составы." },
      { href: "/admin/roster/import", perm: "roster.edit", label: "Импорт", icon: "database", desc: "Составы — разобрать таблицу сезона в команды, игроков и места состава. Анкеты — дозаполнить профили из выгрузки CRM: телеграм, дата рождения, город, account_id. Оба с превью перед записью." },
      { href: "/admin/moderation", perm: "accounts.approve", label: "Модерация", icon: "log", desc: "Анкеты новых игроков и привязки к профилю: одобрить с заведением профиля или вернуть с причиной." },
      { href: "/admin/staff", perm: "accounts.admins", label: "Команда лиги", icon: "shield", desc: "Владелец и админы: назначение роли и раздача прав по галочкам." },
      { href: "/admin/tp", perm: "tp.edit", label: "TP", icon: "star", desc: "Начисление сезонных очков MVP игрокам." },
      { href: "/admin/bot", perm: "tournaments.edit", label: "Телеграм-бот", icon: "send", desc: "Разговор бота нодами: что он говорит, какие кнопки показывает и куда ведёт каждая. Рядом — тайминги напоминаний." },
      { href: "/admin/duplicates", perm: "roster.edit", label: "Дубли профилей", icon: "users", desc: "Похожие профили одного человека: объединить, переименовать или развести." },
      { href: "/admin/roster/ranks", perm: "roster.edit", label: "Ранги", icon: "up", desc: "Сверить ранги лиги с OpenDota одной кнопкой и увидеть, у кого он изменился с прошлого раза." },
      { href: "/admin/quizzes", perm: "quizzes", label: "Анкеты", icon: "comment", desc: "Опросы и записи на ивенты: бот собирает ответы в телеграме." },
    ],
  },
  {
    slug: "analytics",
    title: "Аналитика",
    icon: "chart",
    desc: "Разбор матчей, показатели сезона и карта вардов по архиву.",
    tools: [
      { href: "/match", perm: "tools", label: "Разбор матча", icon: "chart", desc: "Постгейм-отчёт по ID матча из Dota 2." },
      { href: "/admin/vision", perm: "tools", label: "Варды", icon: "pin", desc: "Карта расстановки вардов команды по архиву." },
      { href: "/admin/stats", perm: "tools", label: "Показатели", icon: "performance", desc: "Топ-5 по каждой метрике: разрез дивизион / стадия / игроки или команды." },
    ],
  },
  {
    slug: "tools",
    title: "Инструменты",
    icon: "settings",
    desc: "Архив серий, турнирная графика, внешний вид сайта и то, что из данных лиги видно публике.",
    tools: [
      { href: "/admin/series", perm: "series.edit", label: "Архив серий", icon: "history", desc: "Встречи турнира и карты в них — отсюда стата идёт в статистику." },
      { href: "/studio/editor", perm: "studio", label: "Студия", icon: "photo", desc: "Сборка турнирной графики по данным ростера." },
      { href: "/admin/theme", perm: "theme", label: "Тема", icon: "settings", desc: "Цвета UI проекта: акцент, поверхности, текст. Правится и едет в data/theme.json." },
      { href: "/admin/banner", perm: "banner", label: "Баннер главной", icon: "home", desc: "Первый экран лиги: картинка, заголовок, подпись и кнопка. Пусто или выключен — на главной работает герой по данным." },
      { href: "/admin/privacy", perm: "privacy", label: "Приватность витрины", icon: "eye-off", desc: "Показ телеграма и MMR на публичной части. Выключено — данных нет ни на странице, ни в открытом API, ни в ответах бота." },
    ],
  },
];

/** Инструмент, у которого есть индикатор очереди. */
export const QUEUE_TOOL = "/admin/moderation";
/** Инструмент, у которого есть индикатор похожих профилей. */
export const DUPLICATES_TOOL = "/admin/duplicates";

/** Группы, срезанные правами: пустые группы отбрасываем — заголовок без пунктов только мешает. */
export function toolGroupsFor(perms: PermissionKey[]): ToolGroup[] {
  return TOOL_GROUPS.map((g) => ({ ...g, tools: g.tools.filter((t) => perms.includes(t.perm)) })).filter(
    (g) => g.tools.length > 0,
  );
}

/** Адрес страницы группы. Строится из реестра — руками по маршрутам не перечисляется. */
export const groupHref = (g: Pick<ToolGroup, "slug">) => `/admin/${g.slug}`;

/**
 * Группа, которой принадлежит текущий адрес, — по префиксу `href` инструмента. Нужна крошкам:
 * вторую ступень подставляет шапка, а не двадцать страниц. Совпадение ищем самое длинное —
 * `/admin/roster/import` и `/admin/roster/ranks` начинаются одинаково.
 *
 * Сама страница группы сюда не попадает: её имя несёт H1, а последняя ступень крошек не рисуется.
 */
export function groupForPath(pathname: string): ToolGroup | undefined {
  let best: { group: ToolGroup; len: number } | undefined;
  for (const g of TOOL_GROUPS) {
    for (const t of g.tools) {
      if (pathname !== t.href && !pathname.startsWith(`${t.href}/`)) continue;
      if (!best || t.href.length > best.len) best = { group: g, len: t.href.length };
    }
  }
  return best?.group;
}
