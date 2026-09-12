import "server-only";
import Link from "next/link";
import { currentPermissions } from "@/lib/account";
import { currentTournament } from "@/lib/tournaments";
import { messages } from "@/lib/chat";
import { roleShort } from "@/lib/roles";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { Footer } from "./footer";
import { currentAccountNav } from "./account-nav";
import { AvatarMenu } from "./avatar-menu";
import { HomeNavRow, HomeNavSheet, type NavLink } from "./home-nav";
import { Notifications, type NotificationLine } from "./notifications";

// Хром витрины: верхняя строка вместо сайдбара. Только у главной (`(home)/layout.tsx`).
//
// Почему главная — исключение из «одной колонки на все страницы» (UI-GUIDELINES §2). Сайдбар
// решает задачу «я внутри продукта и хожу между разделами»: он всегда показывает, где я стою и
// что рядом. На главной стоять негде — она сама и есть верх, а активного пункта в колонке при
// этом ровно один, «Главная». Взамен колонка съедает 300px витрины и первым экраном лиги делает
// список ссылок. Поэтому здесь строка: бренд слева, разделы посередине, аккаунт справа
// (решение 09.09, §E2 RELEASE-PLAN). Второго ряда хрома на витрине нет — этот единственный.
//
// Строка разложена тремя ОСТРОВАМИ по макету `design/home/Menus.dc.html`: у бренда, у разделов и
// у входа своя подушка с зазором между ними. Одна плита во всю ширину читалась как полка, на
// которой всё лежит вперемешку; три острова разводят «кто я», «куда пойти» и «что с аккаунтом».
//
// Ниже `lg` островов нет: три подушки с зазорами в 358px не сходятся, поэтому ряд сам становится
// одной подушкой (`.mbar` из `Mobile.dc.html`), а разделы уезжают под бургер (`home-nav.tsx`).

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

export async function HomeShell({ children }: { children: React.ReactNode }) {
  const [{ account: navAccount, cabinet, chat, system, spot }, perms, current] = await Promise.all([
    currentAccountNav(),
    currentPermissions(),
    currentTournament(),
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

  const links: NavLink[] = [
    { href: "/", label: "Главная", accent: true },
    // Турнира нет — пункта нет: пустая ссылка «LOST cup» вела бы в никуда.
    ...(current ? [{ href: `/tournaments/${current.slug}`, label: "LOST cup", accent: true }] : []),
    { href: "/roster", label: "Команды" },
    { href: "/roster/players", label: "Игроки" },
    { href: "/rules", label: "Правила" },
  ];

  // Подпись под ником в меню — «команда · позиция» из макета. Своя, а не общая `account.role`:
  // ту же подпись показывает сайдбар, а его эта задача не трогает.
  const subtitle = spot
    ? [spot.team.name, roleShort(spot.role)].filter(Boolean).join(" · ")
    : undefined;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className={`mx-auto w-full ${SITE_MAX_W} px-4 pb-2 pt-5 font-pouf md:px-6`}>
        {/* Ниже `lg` подушка одна на весь ряд, с `lg` она распадается на три острова. */}
        <div className="flex items-center gap-3 max-lg:rounded-card max-lg:bg-surface max-lg:px-3 max-lg:py-2.5 max-lg:cushion-card">
          <HomeNavSheet links={links} />

          <Link
            href="/"
            className="flex min-w-0 shrink items-center gap-2.5 rounded-card lg:bg-surface lg:px-4 lg:py-2.5 lg:cushion-card"
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

          <HomeNavRow links={links} />

          <div className="ml-auto flex shrink-0 items-center gap-2.5 rounded-card lg:bg-surface lg:px-3 lg:py-2.5 lg:cushion-card">
            {/* Колокольчик есть только у того, кому лига может написать: у гостя и у аккаунта без
                карточки игрока служебного канала нет вовсе, и пустой значок им ни о чём. */}
            {chat && (
              <Notifications conversationId={system.conversationId} unread={system.unread} lines={lines} />
            )}
            <AvatarMenu account={navAccount} items={cabinet} tools={perms.length > 0} subtitle={subtitle} />
          </div>
        </div>
      </header>
      {children}
      <Footer />
    </div>
  );
}
