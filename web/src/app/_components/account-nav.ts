import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { playerPath } from "@/lib/profiles";
import { currentAccount, effectiveRole, type Account } from "@/lib/account";
import { resolveUpload } from "@/lib/uploads";
import type { Role } from "@/lib/player-auth";
import { chatIdentity, unreadTotal } from "@/lib/chat";
import type { NavAccount, NavItem } from "./nav-model";

// Кто вошёл — одним ответом на оба хрома продукта: колонку (`app-shell.tsx`) и верхнюю строку
// витрины (`home-shell.tsx`). Вынесено сюда, потому что вход в аккаунт по стандарту ОДИН
// (UI-GUIDELINES §2): профиль-блок сайдбара и аватар-меню главной — это одна и та же дверь,
// показанная в двух местах, и расходиться в пунктах или в подписи под ником они не должны.

// Роль всегда на виду: подпись и цвет точки. Цвета — из макета «Сайдбар».
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

/** Действующее место в составе: команда и капитанство. */
export type NavSpot = { isCaptain: boolean; team: { id: number; name: string } };

export type AccountNav = {
  /** Шапка входа: имя, роль, аватар. null — гость. */
  account: NavAccount | null;
  /** Исходная запись аккаунта — чтобы страница не спрашивала её у базы второй раз. */
  raw: Account | null;
  /** Пункты кабинета: профиль, сообщения, настройки, команда. */
  cabinet: NavItem[];
  /** Личка: есть только у игрока лиги — по ней решается и пункт «Сообщения», и живой канал. */
  chat: ReturnType<typeof chatIdentity>;
  unread: number;
  spot: NavSpot | null;
};

export async function accountNav(account: Account | null): Promise<AccountNav> {
  // Чат и присутствие: канал открывает только игрок лиги, а снимок «кто в сети» нужен и гостю.
  const chat = chatIdentity(account);
  const unread = chat ? await unreadTotal(chat.accountId) : 0;

  if (!account) return { account: null, raw: null, cabinet: [], chat, unread, spot: null };

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

  // Кабинет. У гостя его нет вовсе: единственная дверь — профиль-блок (или аватар на витрине),
  // и второй ряд ссылок «войти» под ним был бы тем же входом второй раз.
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
      hint: "Личные диалоги с игроками лиги",
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
    unread,
    spot,
  };
}

/**
 * То же самое для текущего запроса, одним вызовом на весь рендер. `cache` из React снимает
 * повтор: витрину рисуют и хром (`home-shell.tsx`), и сама страница, а спрашивать аккаунт,
 * состав и непрочитанное дважды за один запрос незачем.
 */
export const currentAccountNav = cache(async () => accountNav(await currentAccount()));
