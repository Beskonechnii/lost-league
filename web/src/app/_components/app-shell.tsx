import "server-only";
import { playerPath } from "@/lib/profiles";
import { prisma } from "@/lib/prisma";
import { currentAccount, effectiveRole, currentPermissions, pendingClaims, pendingRegistrations } from "@/lib/account";
import { resolveUpload } from "@/lib/uploads";
import type { Role } from "@/lib/player-auth";
import { chatIdentity, unreadTotal } from "@/lib/chat";
import { onlineCount, onlinePlayerIds } from "@/lib/presence";
import { AppSidebar } from "./app-sidebar";
import { ChatLiveProvider } from "./chat-live";
import { QUEUE_TOOL, toolGroupsFor } from "./tools";
import type { NavAccount, NavItem, NavSection } from "./nav-model";

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

/** Низ колонки: то, что нужно редко, но всегда на одном месте. */
const FOOTER: NavItem[] = [{ href: "/rules", label: "Правила лиги", icon: "book" }];

// Роль всегда на виду в профиль-блоке: подпись и цвет точки. Цвета — из макета «Сайдбар».
const ROLE_META: Record<Role, { label: string; dot: string }> = {
  owner: { label: "Владелец лиги", dot: "#E8C56E" },
  admin: { label: "Администратор", dot: "#8CC9AA" },
  player: { label: "Игрок", dot: "#AEAAA0" },
};

/**
 * Две буквы на аватар: первые буквы двух слов, иначе первые две буквы одного.
 *
 * Слова чистим от небуквенного: у «Админ (тест)» второе слово начинается со скобки, и аватар
 * показывал «А(». Скобки, кавычки и дефисы в имени встречаются постоянно — это не редкий случай.
 */
function initials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+/u, ""))
    .filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toLocaleUpperCase("ru");
  return (words[0] ?? "?").slice(0, 2).toLocaleUpperCase("ru");
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const account = await currentAccount();
  const perms = await currentPermissions();

  // Число новых в очереди считаем только тому, кто её и так видит — остальным запрос ни к чему.
  const [queue, claims] = perms.includes("accounts.approve")
    ? await Promise.all([pendingRegistrations(), pendingClaims()])
    : [[], []];
  const pending = queue.length + claims.length;

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
      badge: t.href === QUEUE_TOOL ? pending : undefined,
    })),
  }));

  // Кабинет. У гостя его нет вовсе: единственная дверь — профиль-блок в шапке колонки, и второй
  // ряд ссылок «войти» под ним был бы тем же входом второй раз.
  const cabinet: NavItem[] = [];
  let navAccount: NavAccount | null = null;

  // Чат и присутствие: канал открывает только игрок лиги, а снимок «кто в сети» нужен и гостю —
  // точки у карточек ростера рисуются всем, просто у гостя они не обновляются вживую.
  const chat = chatIdentity(account);
  const unread = chat ? await unreadTotal(chat.accountId) : 0;

  if (account) {
    const role = effectiveRole(account);
    const player = account.player;

    // Команда игрока — по последнему месту в составе: сезоны идут по возрастанию id, и «моя
    // команда» это та, за которую он играет сейчас, а не та, за которую играл когда-то.
    const spot = player
      ? await prisma.rosterSpot.findFirst({
          where: { playerId: player.id },
          orderBy: { id: "desc" },
          select: { isCaptain: true, team: { select: { id: true, name: true } } },
        })
      : null;

    // «Профиль» ведёт на страницу игрока в лиге, а не в кабинет: у одобренного игрока это одна и
    // та же страница (`/me` сам уводит туда). Кабинет остаётся дверью для тех, у кого профиля ещё
    // нет — им ссылка и ведёт в `/me`. Отдельного пункта «Моя карточка» больше нет: он дублировал
    // этот же адрес.
    cabinet.push({
      href: player ? playerPath(player) : "/me",
      label: "Профиль",
      icon: "user",
      match: player ? ["/me", playerPath(player)] : ["/me"],
    });
    // Личка — только у игрока лиги: писать и получать может тот, кого одобрили и привязали к
    // профилю (src/lib/chat.ts). У остальных пункта нет вовсе, а не «есть, но ругается».
    if (chat) cabinet.push({ href: "/chat", label: "Сообщения", icon: "comment", hint: "Личные диалоги с игроками лиги", badge: unread });
    cabinet.push({ href: "/me/settings", label: "Настройки", icon: "settings", hint: "Вход, пароль, аккаунт" });
    if (spot) cabinet.push({ href: `/roster/teams/${spot.team.id}`, label: "Моя команда", icon: "shield" });

    const name = player?.nickname ?? account.name ?? account.email?.split("@")[0] ?? "Игрок";
    navAccount = {
      name,
      // Игроку интереснее его место в лиге, чем слово «игрок»; админу и владельцу — их роль.
      role: role === "player" && spot ? `${spot.isCaptain ? "Капитан" : "Игрок"} · ${spot.team.name}` : ROLE_META[role].label,
      dot: ROLE_META[role].dot,
      initials: initials(name),
      photo: player ? await resolveUpload("players", player.slug, "photo", player.photo) : account.avatar,
    };
  }

  // Порядок колонки — по частоте обращения, а не по «сначала общее, потом служебное»: свой кабинет
  // и очередь модерации открывают каждый день, лигу — когда идёт тур, остальное реже. Секции, не
  // названные в списке, идут следом в порядке реестра инструментов.
  const sections: NavSection[] = [LEAGUE, ...tools];
  if (cabinet.length > 0) sections.push({ title: "Кабинет", items: cabinet });

  const ORDER = ["Кабинет", "Модерация", "Лига", "Showmatch"];
  const rank = (title: string) => {
    const i = ORDER.indexOf(title);
    return i === -1 ? ORDER.length : i;
  };
  sections.sort((a, b) => rank(a.title) - rank(b.title));

  return (
    <ChatLiveProvider live={!!chat} initialPlayers={onlinePlayerIds()} initialCount={onlineCount()}>
      <div className="flex flex-1">
        <AppSidebar sections={sections} footer={FOOTER} account={navAccount} />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </ChatLiveProvider>
  );
}
