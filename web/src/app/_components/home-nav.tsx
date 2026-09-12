"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/pouf/Icon";
import { Sheet } from "@/components/pouf/sheet";

// Разделы витрины в двух раскладках: с `lg` — ряд пилюль в своём острове, ниже — лист из-под
// бургера. Пять пилюль, бренд и остров входа в 390px не встают, а один видимый пункт из пяти
// читался бы как «половина навигации спрятана» (решение design, ТЗ 06 подэтап C).
//
// Пилюля общая на обе раскладки: второй словарь навигации разъехался бы с первым через месяц.
// Лист — тот же `pouf/sheet.tsx`, которым открывает подписи мобильный рельс сайдбара: одно
// действие «открыть навигацию» — одна манера.

/** Пункт строки. `accent` — «LOST cup», он же текущий турнир: единственный пункт со сроком. */
export type NavLink = { href: string; label: string; accent?: boolean };

const focus = "outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]";

/** `block` — та же пилюля, разложенная в колонку листа: высота строки не ниже тач-цели. */
const pill = (accent: boolean | undefined, block = false) =>
  `rounded-control-sm py-2.5 text-[13px] font-extrabold transition ${focus} ${
    block ? "flex min-h-11 w-full items-center px-4" : "px-3 sm:px-[18px]"
  } ${
    accent
      ? "bg-accent-fill text-[var(--on-accent)] cushion-blob"
      : "text-ink-muted hover:bg-surface-2 hover:text-ink"
  }`;

/** Ряд пилюль — остров разделов на широком экране. */
export function HomeNavRow({ links }: { links: NavLink[] }) {
  const path = usePathname();
  return (
    <nav className="hidden min-w-0 items-center gap-2 rounded-card bg-surface px-3 py-2.5 cushion-card lg:flex">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.href === path ? "page" : undefined}
          className={pill(l.accent)}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

/** Бургер и лист — те же пункты на узком экране. Аватара, «Сообщений» и выхода в листе нет:
 *  вход в аккаунт остаётся видимым в шапке, а копия кабинета в листе — второй вход. */
export function HomeNavSheet({ links }: { links: NavLink[] }) {
  const path = usePathname();
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
          <Link
            key={l.href}
            href={l.href}
            aria-current={l.href === path ? "page" : undefined}
            // Лист живёт вне маршрута и о переходе сам не узнаёт — закрываем пунктом.
            onClick={() => setOpen(false)}
            className={pill(l.accent, true)}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </Sheet>
  );
}
