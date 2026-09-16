import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { playerPath } from "@/lib/profiles";
import { currentAccount, effectiveRole, type Account } from "@/lib/account";
import { resolveUpload } from "@/lib/uploads";
import type { Role } from "@/lib/player-auth";
import { chatIdentity, liveIdentity, findConversation, unreadInConversation, unreadTotal } from "@/lib/chat";
import { systemAccountId } from "@/lib/system-chat";
import type { NavAccount, NavItem } from "./nav-model";

// Кто вошёл — одним ответом хрому продукта (`app-shell.tsx`). Вынесено сюда, потому что вход в
// аккаунт по стандарту ОДИН (UI-GUIDELINES §2), а пункты кабинета нужны и бару, и страницам,
// которые их показывают: второй сборщик разъехался бы с первым на первой же правке.

// Роль всегда на виду: подпись и цвет точки. Цвета — из макета Кита.
export const ROLE_META: Record<Role, { label: string; dot: string }> = {
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
export function initials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+/u, ""))
    .filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toLocaleUpperCase("ru");
  return (words[0] ?? "?").slice(0, 2).toLocaleUpperCase("ru");
}

/** Действующее место в составе: команда, капитанство и позиция в пятёрке. */
export type NavSpot = { isCaptain: boolean; role: string | null; team: { id: number; name: string } };

/** Служебный канал лиги: беседа и её непрочитанное — колокольчику витрины. */
export type NavSystemChat = { conversationId: number | null; unread: number };

export type AccountNav = {
  /** Шапка входа: имя, роль, аватар. null — гость. */
  account: NavAccount | null;
  /** Исходная запись аккаунта — чтобы страница не спрашивала её у базы второй раз. */
  raw: Account | null;
  /** Пункты кабинета: профиль, сообщения, настройки, команда. */
  cabinet: NavItem[];
  /** Личка: есть только у игрока лиги — по ней решается пункт «Сообщения». */
  chat: ReturnType<typeof chatIdentity>;
  /** Живой канал шире лички: его открывает любой одобренный аккаунт, в том числе без профиля
   *  в ростере — иначе админ комнаты не видел бы событий лобби (ТЗ 22б §8). */
  live: boolean;
  /** Непрочитанное ЛИЧНЫХ бесед — без служебного канала: его считает колокольчик. */
  unread: number;
  system: NavSystemChat;
  spot: NavSpot | null;
};

/** Беседа игрока с лигой и её непрочитанное. Нет служебного аккаунта — канала ещё нет. */
async function systemChat(meAccountId: number): Promise<NavSystemChat> {
  const systemId = await systemAccountId();
  const conversationId = systemId ? await findConversation(meAccountId, systemId) : null;
  return { conversationId, unread: conversationId ? await unreadInConversation(conversationId, meAccountId) : 0 };
}

export async function accountNav(account: Account | null): Promise<AccountNav> {
  // Чат и присутствие: личку открывает только игрок лиги, а снимок «кто в сети» нужен и гостю.
  const chat = chatIdentity(account);
  // Служебный канал считаем по `liveIdentity`, а не по `chatIdentity`: писать в него лига может
  // ЛЮБОМУ одобренному аккаунту (`tellAccount`), в том числе оператору без карточки игрока — и
  // именно ему приходят строки очередей. По `chatIdentity` колокольчика у него не было вовсе,
  // и прислать уведомление было некуда (ТЗ 28 DESIGN §4).
  const me = liveIdentity(account);
  const live = me !== null;
  const [total, system] = me
    ? await Promise.all([unreadTotal(me.accountId), systemChat(me.accountId)])
    : [0, { conversationId: null, unread: 0 } satisfies NavSystemChat];
  // Два счётчика не пересекаются и вместе дают прежнюю сумму: колокольчик — служебное,
  // «Сообщения» — всё остальное. Иначе одно непрочитанное светится в двух местах сразу.
  const unread = Math.max(0, total - system.unread);

  if (!account) return { account: null, raw: null, cabinet: [], chat, live, unread, system, spot: null };

  const role = effectiveRole(account);
  const player = account.player;

  // Команда игрока — по последнему месту в составе: сезоны идут по возрастанию id, и «моя
  // команда» это та, за которую он играет сейчас, а не та, за которую играл когда-то.
  const spot = player
    ? await prisma.rosterSpot.findFirst({
        where: { playerId: player.id },
        orderBy: { id: "desc" },
        select: { isCaptain: true, role: true, team: { select: { id: true, name: true } } },
      })
    : null;

  // Кабинет. У гостя его нет вовсе: единственная дверь — кнопка «Войти» в баре, и второй ряд
  // ссылок «войти» под ней был бы тем же входом второй раз.
  const cabinet: NavItem[] = [];

  // «Профиль» ведёт на страницу игрока в лиге, а не в кабинет: у одобренного игрока это одна и
  // та же страница (`/me` сам уводит туда). Кабинет остаётся дверью для тех, у кого профиля ещё
  // нет — им ссылка и ведёт в `/me`.
  cabinet.push({
    href: player ? playerPath(player) : "/me",
    // Название по тому, куда пункт ведёт: у игрока это его карточка в лиге («Профиль»),
    // у аккаунта без профиля — развилка `/me` с заголовком «Личный кабинет».
    label: player ? "Профиль" : "Кабинет",
    icon: "user",
    match: player ? ["/me", playerPath(player)] : ["/me"],
  });
  // Личка — только у игрока лиги: писать и получать может тот, кого одобрили и привязали к
  // профилю (src/lib/chat.ts). У остальных пункта нет вовсе, а не «есть, но ругается».
  if (chat)
    cabinet.push({
      href: "/chat",
      label: "Сообщения",
      icon: "comment",
      hint: "Переписка с игроками лиги",
      badge: unread,
    });
  cabinet.push({ href: "/me/settings", label: "Настройки", icon: "settings", hint: "Вход, пароль, аккаунт" });
  if (spot) cabinet.push({ href: `/roster/teams/${spot.team.id}`, label: "Моя команда", icon: "shield" });

  const name = player?.nickname ?? account.name ?? account.email?.split("@")[0] ?? "Игрок";

  return {
    raw: account,
    account: {
      name,
      // Игроку интереснее его место в лиге, чем слово «игрок»; админу и владельцу — их роль.
      role:
        role === "player" && spot
          ? `${spot.isCaptain ? "Капитан" : "Игрок"} · ${spot.team.name}`
          : ROLE_META[role].label,
      dot: ROLE_META[role].dot,
      initials: initials(name),
      photo: player ? await resolveUpload("players", player.slug, "photo", player.photo) : account.avatar,
    },
    cabinet,
    chat,
    live,
    unread,
    system,
    spot,
  };
}

/**
 * То же самое для текущего запроса, одним вызовом на весь рендер. `cache` из React снимает
 * повтор: страницу рисуют и хром (`app-shell.tsx`), и она сама, а спрашивать аккаунт,
 * состав и непрочитанное дважды за один запрос незачем.
 */
export const currentAccountNav = cache(async () => accountNav(await currentAccount()));
