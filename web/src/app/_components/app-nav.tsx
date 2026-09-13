"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/pouf/Icon";
import { Separator } from "@/components/pouf/separator";
import { Sheet } from "@/components/pouf/sheet";
import { LeagueSearch } from "./league-search";

// Клиентская часть верхнего бара — навигация всего продукта (ТЗ 08): ряд пилюль, лист из-под
// бургера и поиск. Сайдбара больше нет, поэтому эти три штуки стоят на каждой странице, а не
// только на главной.
//
// Пилюля общая на ряд и на лист: второй словарь навигации разъехался бы с первым через месяц.
// Лист — тот же `pouf/sheet.tsx`, которым открывается поиск на узком экране: одно действие
// «открыть» — одна манера.

/**
 * Пункт бара. `accent` — единственная акцентная пилюля ряда («Турниры»); `icon` есть только у
 * служебного пункта («Админ») и заодно отбивает его от разделов витрины в листе.
 */
export type NavLink = {
  href: string;
  label: string;
  accent?: boolean;
  icon?: IconName;
  /** Дополнительные префиксы, на которых пункт считается активным. */
  match?: string[];
};

const focus = "outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]";

/** `block` — та же пилюля, разложенная в колонку листа: высота строки не ниже тач-цели. */
const pill = (link: NavLink, active: boolean, block = false) =>
  `rounded-control-sm py-2.5 text-[13px] font-extrabold transition ${focus} ${
    block ? "flex min-h-11 w-full items-center gap-2 px-4" : "inline-flex items-center gap-1.5 px-3 sm:px-[18px]"
  } ${
    link.accent
      ? "bg-accent-fill text-[var(--on-accent)] cushion-blob"
      : active
        ? "bg-surface-2 text-ink"
        : "text-ink-muted hover:bg-surface-2 hover:text-ink"
  }`;

/** Активен пункт, если путь совпал, лежит внутри него или подошёл под один из его префиксов. */
function matches(pathname: string, link: NavLink) {
  const hrefs = [link.href, ...(link.match ?? [])];
  return hrefs.some((h) => (h === "/" ? pathname === "/" : pathname === h || pathname.startsWith(`${h}/`)));
}

/**
 * Активен ровно один пункт — самый конкретный из подошедших. Без этого на `/roster/players`
 * загорались бы и «Игроки», и «Команды», объявившая `/roster` своим адресом.
 */
function useActiveHref(links: NavLink[]) {
  const pathname = usePathname();
  let best = "";
  let bestLen = 0;
  for (const link of links) {
    if (!matches(pathname, link)) continue;
    const len = Math.max(...[link.href, ...(link.match ?? [])].map((h) => (pathname.startsWith(h) ? h.length : 0)));
    if (len > bestLen) {
      bestLen = len;
      best = link.href;
    }
  }
  return best;
}

/** Ряд пилюль — остров разделов на широком экране. */
export function NavRow({ links }: { links: NavLink[] }) {
  const active = useActiveHref(links);
  return (
    <nav className="hidden min-w-0 items-center gap-2 rounded-card bg-surface px-3 py-2.5 cushion-card lg:flex">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.href === active ? "page" : undefined}
          className={pill(l, l.href === active)}
        >
          {l.icon && <Icon name={l.icon} size="sm" />}
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

/** Бургер и лист — те же пункты на узком экране. Аватара, «Сообщений» и выхода в листе нет:
 *  вход в аккаунт остаётся видимым в шапке, а копия кабинета в листе — второй вход. */
export function NavSheet({ links }: { links: NavLink[] }) {
  const active = useActiveHref(links);
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Разделы"
      description="Куда пойти в лиге"
      trigger={
        <button
          type="button"
          aria-label="Открыть разделы"
          title="Разделы"
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-control-sm bg-surface text-ink cushion-row lg:hidden ${focus}`}
        >
          <Icon name="menu" size="sm" />
        </button>
      }
    >
      <div className="flex flex-col gap-2 font-pouf">
        {links.map((l) => (
          <React.Fragment key={l.href}>
            {/* Служебный пункт («Админ») отбит от разделов витрины: в колонке листа должно быть
                видно, что это не раздел лиги. */}
            {l.icon && <Separator />}
            <Link
              href={l.href}
              aria-current={l.href === active ? "page" : undefined}
              // Лист живёт вне маршрута и о переходе сам не узнаёт — закрываем пунктом.
              onClick={() => setOpen(false)}
              className={pill(l, l.href === active, true)}
            >
              {l.icon && <Icon name={l.icon} size="sm" />}
              {l.label}
            </Link>
          </React.Fragment>
        ))}
      </div>
    </Sheet>
  );
}

/**
 * Поиск по лиге в острове входа. С `xl` — поле шириной 240px, ниже — кнопка 44×44, открывающая
 * то же поле в листе: раньше пилюль сворачивается именно поиск (разделы — навигация, поиск —
 * ускоритель), а выпадающий список на телефоне перекрыл бы половину экрана.
 */
export function BarSearch() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <div className="hidden w-60 xl:block">
        <LeagueSearch />
      </div>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Поиск по лиге"
        description="Команды, игроки, турниры"
        trigger={
          <button
            type="button"
            aria-label="Поиск по лиге"
            title="Поиск"
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-control-sm text-ink transition hover:bg-surface-2 xl:hidden ${focus}`}
          >
            <Icon name="search" size="sm" />
          </button>
        }
      >
        <LeagueSearch onNavigate={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
