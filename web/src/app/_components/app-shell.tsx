import "server-only";
import { currentAccount, currentPermissions, pendingClaims, pendingRegistrations } from "@/lib/account";
import { pendingProfileEditCount } from "@/lib/profile-edit";
import { duplicatesCount } from "@/lib/duplicates";
import { onlineCount, onlinePlayerIds } from "@/lib/presence";
import { AppSidebar } from "./app-sidebar";
import { Footer } from "./footer";
import { ChatLiveProvider } from "./chat-live";
import { accountNav } from "./account-nav";
import { QUEUE_TOOL, DUPLICATES_TOOL, toolGroupsFor } from "./tools";
import type { NavItem, NavSection } from "./nav-model";

// Хром продукта: сайдбар слева, страница справа — один на обе группы маршрутов (DECISIONS, 02.09).
// Здесь он собирается, потому что состав пунктов зависит от прав и от того, кто вошёл, а это
// серверные вопросы; сама колонка (app-sidebar.tsx) уже чистый клиент.

/**
 * Разделы лиги — то, что видит любой посетитель. Ровно два: это те же две вкладки, что стояли в
 * убранной верхней строке. Таблица, плей-офф, статистика, TP и ростер сезона сюда НЕ поднимаются:
 * они выбирают этап внутри турнира (уровень L3, строка `tournament-bar`), и вторая копия того же
 * выбора в глобальной колонке — ровно тот антипаттерн «один уровень — две модели» из §2 стандарта.
 */
const LEAGUE: NavSection = {
  title: "Лига",
  items: [
    {
      href: "/tournaments",
      label: "Турниры",
      icon: "trophy",
      hint: "Сезоны и кубки лиги: таблицы, сетка, составы",
      match: ["/tournaments", "/standings", "/series", "/tp"],
    },
    { href: "/roster", label: "Ростер", icon: "users", hint: "Все команды лиги: фильтр по турниру и поиск" },
  ],
};

/** Главная — над всеми разделами и без подписи секции: это дверь на витрину, а не раздел.
 *  Внизу, в «Лиге», она терялась — до неё нужно долистать мимо кабинета и инструментов. */
const HOME: NavSection = {
  title: "",
  items: [{ href: "/", label: "Главная", icon: "home", hint: "Витрина лиги" }],
};

/** Низ колонки: то, что нужно редко, но всегда на одном месте. */
const FOOTER: NavItem[] = [{ href: "/rules", label: "Правила лиги", icon: "book" }];

export async function AppShell({ children }: { children: React.ReactNode }) {
  const account = await currentAccount();
  const perms = await currentPermissions();

  // Число новых в очереди считаем только тому, кто её и так видит — остальным запрос ни к чему.
  const [queue, claims] = perms.includes("accounts.approve")
    ? await Promise.all([pendingRegistrations(), pendingClaims()])
    : [[], []];
  // Правки профиля (в том числе MMR с сайта) лежат в той же очереди, но под своим правом —
  // без него вкладки не видно, и в значок их считать нечего.
  const edits = perms.includes("roster.edit") ? await pendingProfileEditCount() : 0;
  const pending = queue.length + claims.length + edits;
  // Похожие профили — своя очередь под тем же правом, что и правки: обе задачи решает тот, у кого
  // есть roster.edit, второй счётчик не запрашиваем зря у остальных.
  const duplicates = perms.includes("roster.edit") ? await duplicatesCount() : 0;
  const badges: Record<string, number> = { [QUEUE_TOOL]: pending, [DUPLICATES_TOOL]: duplicates };

  // Инструменты операторской — из общего реестра, срезанного правами. Пункт без права не рисуется:
  // это витрина, а не защита; сами роуты проверяют право у себя.
  const tools: NavSection[] = toolGroupsFor(perms).map((g) => ({
    title: g.title,
    items: g.tools.map((t) => ({
      href: t.href,
      label: t.label,
      icon: t.icon,
      hint: t.desc,
      soon: t.soon,
      badge: badges[t.href],
    })),
  }));

  // Кто вошёл и его кабинет — общий сборщик с витриной (`account-nav.ts`): вход в аккаунт один,
  // и пункты в колонке обязаны совпадать с пунктами аватар-меню главной.
  const { account: navAccount, cabinet, chat } = await accountNav(account);

  // Порядок колонки: кабинет, витрины лиги, потом инструменты. «Лига» стоит выше «Модерации»,
  // хотя очередь и открывают чаще: в модерации девять пунктов, и снизу от них «Турниры» с
  // «Ростером» — две главные витрины продукта — уезжали под сгиб, до них приходилось листать.
  // Секции, не названные в списке, идут следом в порядке реестра инструментов.
  const sections: NavSection[] = [LEAGUE, ...tools];
  if (cabinet.length > 0) sections.push({ title: "Кабинет", items: cabinet });

  const ORDER = ["Кабинет", "Лига", "Модерация", "Showmatch"];
  const rank = (title: string) => {
    const i = ORDER.indexOf(title);
    return i === -1 ? ORDER.length : i;
  };
  sections.sort((a, b) => rank(a.title) - rank(b.title));

  // «Главная» — всегда первой, вне сортировки по частоте: она ни к одной секции не относится.
  sections.unshift(HOME);

  return (
    <ChatLiveProvider live={!!chat} initialPlayers={onlinePlayerIds()} initialCount={onlineCount()}>
      <div className="flex flex-1">
        <AppSidebar sections={sections} footer={FOOTER} account={navAccount} />
        <div className="flex min-w-0 flex-1 flex-col">
          {children}
          <Footer />
        </div>
      </div>
    </ChatLiveProvider>
  );
}
