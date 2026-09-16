import "server-only";
import Link from "next/link";
import { currentPermissions } from "@/lib/account";
import { messages } from "@/lib/chat";
import { onlineCount, onlinePlayerIds } from "@/lib/presence";
import { roleShort } from "@/lib/roles";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { Footer } from "./footer";
import { ChatLiveProvider } from "./chat-live";
import { currentAccountNav } from "./account-nav";
import { AvatarMenu } from "./avatar-menu";
import { BarSearch, NavRow, NavSheet, type NavLink } from "./app-nav";
import { Notifications, type NotificationLine } from "./notifications";

// Хром всего продукта: одна верхняя строка на `(home)`, `(public)` и `(admin)` (ТЗ 08, решение
// 13.09). До этого хром был двух видов — строка на главной и левая колонка на всех остальных
// маршрутах, и человек, ушедший с витрины в раздел, попадал в интерфейс другой формы: навигация
// переезжала слева направо, бренд менял место, вход в аккаунт менял вид. Колонка удалена целиком,
// а не оставлена рядом с баром: два бренд-блока и два входа в кабинет на экране запрещены.
//
// Служебные разделы в бар не переезжают: там один пункт «Админ», а двадцать инструментов живут
// плитками на хабе `/admin`. Так бар остаётся коротким и одинаковым везде, а хаб растёт новыми
// инструментами без переделки хрома.
//
// Строка разложена тремя ОСТРОВАМИ по макету `design/home/Menus.dc.html`: у бренда, у разделов и
// у входа своя подушка с зазором между ними. Одна плита во всю ширину читалась как полка, на
// которой всё лежит вперемешку; три острова разводят «кто я», «куда пойти» и «что с аккаунтом».
//
// Ниже `xl` островов нет: три подушки с зазорами в 358px не сходятся, поэтому ряд сам становится
// одной подушкой (`.mbar` из `Mobile.dc.html`), а разделы уезжают под бургер (`app-nav.tsx`).
// Порог именно `xl` (1280), а не `lg`: шести разделам с «Админом» нужно 1112px, а на 1024 доступно
// 976 — ряд сдавливался уже на пяти пунктах (замер в ТЗ 10). Второго ряда хрома и промотки ряда
// вбок не бывает (§2), поэтому лишнюю ширину взять неоткуда — разделы уходят листом раньше.

const date = new Intl.DateTimeFormat("ru", { day: "2-digit", month: "2-digit" });
const clock = new Intl.DateTimeFormat("ru", { hour: "2-digit", minute: "2-digit" });

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Подпись времени строки уведомления: сегодня — часы, вчера — словом, раньше — дата. */
function when(at: Date, now: Date): string {
  const days = Math.round((startOfDay(now) - startOfDay(at)) / 86_400_000);
  if (days === 0) return clock.format(at);
  if (days === 1) return "вчера";
  return date.format(at);
}

/**
 * Разделы витрины. «Турниры» ведут в сам раздел, а не в текущий турнир: раздел существует
 * независимо от того, идёт ли турнир сейчас, и пустой ссылки в никуда больше не бывает.
 * Короткий путь в конкретный турнир открывается с главной и из раздела (решение 13.09).
 */
const SECTIONS: NavLink[] = [
  { href: "/", label: "Главная" },
  // `/series` из «Турниров» ушёл: у ленты встреч теперь свой пункт, а активным в ряду может быть
  // ровно один (UI-GUIDELINES §2) — иначе на `/series` горели бы два сразу.
  { href: "/tournaments", label: "Турниры", match: ["/standings", "/tp"] },
  { href: "/series", label: "Встречи" },
  { href: "/roster", label: "Команды" },
  { href: "/roster/players", label: "Игроки" },
  { href: "/rules", label: "Правила" },
];

/** Служебный пункт. Ведёт на хаб и горит на всём служебном дереве, включая инструменты вне `/admin`. */
const ADMIN: NavLink = {
  href: "/admin",
  label: "Админ",
  icon: "lab",
  match: ["/underbeer", "/match", "/studio"],
};

export async function AppShell({ children }: { children: React.ReactNode }) {
  const [{ account: navAccount, cabinet, chat, live, system, spot }, perms] = await Promise.all([
    currentAccountNav(),
    currentPermissions(),
  ]);

  // Строки панели — последние сообщения той же беседы с лигой, что открыта на `/chat/system`.
  // Непрочитанные всегда свежие: помечаем столько верхних, сколько насчитал колокольчик.
  const lines: NotificationLine[] = [];
  if (chat && system.conversationId) {
    const now = new Date();
    const tail = (await messages(system.conversationId, chat.accountId, { limit: 20 })).reverse().slice(0, 8);
    for (const m of tail)
      lines.push({ id: m.id, text: m.text, time: when(m.createdAt, now), unread: lines.length < system.unread });
  }

  // Пункт без права не рисуется: это витрина, а не защита — сами роуты проверяют право у себя.
  const links: NavLink[] = perms.length > 0 ? [...SECTIONS, ADMIN] : SECTIONS;

  // Подпись под ником в меню — «команда · позиция» из макета.
  const subtitle = spot
    ? [spot.team.name, roleShort(spot.role)].filter(Boolean).join(" · ")
    : undefined;

  return (
    // Провайдер живого канала стоит в хроме, то есть открыт на любой странице: от него зависят
    // и точка «в сети» у карточки игрока, и дорисовка сообщений в чате без перезагрузки.
    <ChatLiveProvider live={live} initialPlayers={onlinePlayerIds()} initialCount={onlineCount()}>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className={`mx-auto w-full ${SITE_MAX_W} px-4 pb-2 pt-5 font-pouf md:px-6`}>
          {/* Ниже `xl` подушка одна на весь ряд, с `xl` она распадается на три острова. */}
          <div className="flex items-center gap-3 max-xl:rounded-card max-xl:bg-surface max-xl:px-3 max-xl:py-2.5 max-xl:cushion-card">
            <NavSheet links={links} />

            <Link
              href="/"
              className="flex min-w-0 shrink items-center gap-2.5 rounded-card xl:bg-surface xl:px-4 xl:py-2.5 xl:cushion-card"
              title="SPIRIT/CTRL — главная"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/brand/mark.svg" alt="" aria-hidden className="h-8 w-auto" />
              {/* На узком экране остаётся один знак: со словом в строку не влезают разделы, а без
                  разделов на телефоне навигации у витрины не остаётся вовсе. */}
              <span
                role="img"
                aria-label="SPIRIT/CTRL"
                className="hidden h-[15px] w-[122px] shrink-0 bg-ink [mask:url(/assets/brand/wordmark.svg)_center/contain_no-repeat] sm:block"
              />
            </Link>

            <NavRow links={links} />

            <div className="ml-auto flex shrink-0 items-center gap-2.5 rounded-card xl:bg-surface xl:px-3 xl:py-2.5 xl:cushion-card">
              {/* Поиск первым в острове: он самый широкий, а колокольчик и аватар обязаны стоять
                  на краю, где их ищут глазами. */}
              <BarSearch />
              {/* Колокольчик есть только у того, кому лига может написать: у гостя и у аккаунта без
                  карточки игрока служебного канала нет вовсе, и пустой значок им ни о чём. */}
              {chat && (
                <Notifications conversationId={system.conversationId} unread={system.unread} lines={lines} />
              )}
              <AvatarMenu account={navAccount} items={cabinet} subtitle={subtitle} />
            </div>
          </div>
        </header>
        {children}
        <Footer />
      </div>
    </ChatLiveProvider>
  );
}
