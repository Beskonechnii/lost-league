"use client";

import { startTransition } from "react";
import Link from "next/link";
import * as RMenu from "@radix-ui/react-dropdown-menu";
import { Icon } from "@/components/pouf/Icon";
import { buttonClasses } from "@/components/pouf/Button";
import { logout } from "@/app/(public)/me/actions";
import type { NavAccount, NavItem } from "./nav-model";

// Аватар-меню — единственный вход в аккаунт во всём продукте (бар, `app-shell.tsx`).
//
// Почему меню, а не профиль-блок в строке: профильные функции — сообщения, настройки, выход —
// должны собраться в одной точке справа сверху. Иначе через месяц до настроек будет три дороги.
//
// Пункты приходят готовыми из `account-nav.ts`; здесь же лежит единственная в продукте форма
// выхода — после удаления колонки второй копии `logout` нет.

const focus = "outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]";

export function AvatarMenu({
  account,
  items,
  /** Подпись под ником. По макету витрины это «команда · позиция»; нет — остаётся роль. */
  subtitle,
}: {
  account: NavAccount | null;
  items: NavItem[];
  subtitle?: string;
}) {
  // Гостю — не пустое меню, а сама дверь: одно нажатие вместо двух.
  if (!account)
    return (
      <Link href="/me" className={buttonClasses({ size: "sm" })}>
        Войти
      </Link>
    );

  const unread = items.reduce((n, i) => n + (i.badge ?? 0), 0);

  return (
    <RMenu.Root>
      <RMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Аккаунт и настройки"
          className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-pill transition ${focus}`}
        >
          <Avatar account={account} size={44} />
          {/* Непрочитанное видно, не открывая меню: иначе о сообщении узнаёшь, только заглянув. */}
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-[19px] min-w-[19px] place-items-center rounded-pill bg-surface px-[5px] text-[10px] font-black tabular-nums text-[var(--color-err-ink)] cushion-row">
              {unread}
            </span>
          )}
        </button>
      </RMenu.Trigger>
      <RMenu.Portal>
        <RMenu.Content className="pouf-menu" sideOffset={10} align="end" collisionPadding={12}>
          {/* Шапка меню: кто вошёл и кем он тут числится. */}
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar account={account} size={38} />
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-black leading-tight text-ink">{account.name}</span>
              <span className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] font-extrabold text-ink-muted">
                <span className="h-2 w-2 shrink-0 rounded-pill" style={{ background: account.dot }} aria-hidden />
                {subtitle ?? account.role}
              </span>
            </span>
          </div>
          <RMenu.Separator className="pouf-menu__sep" />

          {items.map((item) => (
            <RMenu.Item key={item.href} asChild>
              <Link href={item.href} className="pouf-menu__item">
                <Icon name={item.icon} size="sm" />
                {item.label}
                {item.badge ? (
                  <span className="ml-auto grid h-[20px] min-w-[20px] place-items-center rounded-pill bg-surface-2 px-[6px] text-[11px] font-black tabular-nums text-[var(--color-err-ink)]">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            </RMenu.Item>
          ))}

          {/* Пункта «Админ» здесь нет: служебное открывает пилюля в баре, а второй вход в то же
              место — ровно то, что запрещает UI-GUIDELINES §2 (ТЗ 08, решение 13.09). */}

          <RMenu.Separator className="pouf-menu__sep" />
          {/* Выход — server action прямо из пункта. Формой он работал только мышью: Enter на пункте
              Radix обрабатывает сам и до нативного нажатия `submit` дело не доходило, а глушить
              `onSelect` приходилось, иначе меню уносило форму из DOM раньше отправки. Через
              `onSelect` оба пути — мышь и клавиатура — идут одной дорогой. */}
          <RMenu.Item
            className="pouf-menu__item pouf-menu__item--down"
            onSelect={() => startTransition(() => void logout())}
          >
            <Icon name="logout" size="sm" />
            Выйти
          </RMenu.Item>
        </RMenu.Content>
      </RMenu.Portal>
    </RMenu.Root>
  );
}

/** Фото или монограмма. */
function Avatar({ account, size }: { account: NavAccount; size: number }) {
  const style = { width: size, height: size, fontSize: Math.round(size / 2.9) };
  return account.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={account.photo}
      alt=""
      aria-hidden
      style={style}
      className="shrink-0 rounded-pill object-cover cushion-row"
    />
  ) : (
    <span
      style={style}
      aria-hidden
      className="grid shrink-0 place-items-center rounded-pill bg-accent-fill font-black text-[var(--on-accent)] cushion-blob"
    >
      {account.initials}
    </span>
  );
}
