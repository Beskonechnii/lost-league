import "server-only";
import Link from "next/link";
import { currentPermissions } from "@/lib/account";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { Footer } from "./footer";
import { currentAccountNav } from "./account-nav";
import { AvatarMenu } from "./avatar-menu";

// Хром витрины: верхняя строка вместо сайдбара. Только у главной (`(home)/layout.tsx`).
//
// Почему главная — исключение из «одной колонки на все страницы» (UI-GUIDELINES §2). Сайдбар
// решает задачу «я внутри продукта и хожу между разделами»: он всегда показывает, где я стою и
// что рядом. На главной стоять негде — она сама и есть верх, а активного пункта в колонке при
// этом ровно один, «Главная». Взамен колонка съедает 300px витрины и первым экраном лиги делает
// список ссылок. Поэтому здесь строка: бренд слева, разделы посередине, аккаунт справа
// (решение 09.09, §E2 RELEASE-PLAN). Второго ряда хрома на витрине нет — этот единственный.

/** Разделы в строке — те же два, что в секции «Лига» сайдбара, плюс регламент из его подвала. */
const LINKS = [
  { href: "/tournaments", label: "Турниры" },
  { href: "/roster", label: "Ростер" },
  { href: "/rules", label: "Правила" },
];

export async function HomeShell({ children }: { children: React.ReactNode }) {
  const [{ account: navAccount, cabinet }, perms] = await Promise.all([currentAccountNav(), currentPermissions()]);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className={`mx-auto w-full ${SITE_MAX_W} px-4 pb-2 pt-5 font-pouf md:px-6`}>
        <div className="flex items-center gap-3 rounded-[28px] bg-surface px-4 py-3 cushion-card sm:gap-5 sm:px-5">
          <Link href="/" className="flex min-w-0 shrink items-center gap-2.5" title="SPIRIT/CTRL — главная">
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

          <nav className="flex min-w-0 items-center gap-1 sm:gap-2">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-chip px-2.5 py-2 text-[13.5px] font-extrabold text-ink-muted transition hover:bg-surface-2 hover:text-ink sm:px-3 sm:text-[14.5px]"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center">
            <AvatarMenu account={navAccount} items={cabinet} tools={perms.length > 0} />
          </div>
        </div>
      </header>
      {children}
      <Footer />
    </div>
  );
}
