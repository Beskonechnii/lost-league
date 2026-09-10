"use client";

import Link from "next/link";
import * as RMenu from "@radix-ui/react-dropdown-menu";
import { Icon } from "@/components/pouf/Icon";
import { buttonClasses } from "@/components/pouf/Button";
import { logout } from "@/app/(public)/me/actions";
import type { NavAccount, NavItem } from "./nav-model";

// Аватар-меню — вход в аккаунт там, где нет колонки (витрина, `home-shell.tsx`).
//
// Почему меню, а не второй профиль-блок: на главной сайдбара нет вовсе (решение 09.09, §E2
// RELEASE-PLAN), и профильные функции — сообщения, настройки, выход — должны собраться в одной
// точке справа сверху. Иначе через месяц до настроек будет три разных дороги.
//
// Пункты приходят готовыми из `account-nav.ts` — тем же сборщиком, что кормит секцию «Кабинет»
// сайдбара: вход в аккаунт один, и два его вида обязаны показывать одно и то же.

const focus = "outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]";

export function AvatarMenu({
  account,
  items,
  /** Ссылка в операторскую — только тем, у кого есть хоть один инструмент: с главной сайдбар снят,
   *  и без этого пункта оператору неоткуда попасть в свои разделы. */
  tools = false,
}: {
  account: NavAccount | null;
  items: NavItem[];
  tools?: boolean;
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
          {/* Шапка меню повторяет профиль-блок колонки: кто вошёл и кем он тут числится. */}
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar account={account} size={38} />
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-black leading-tight text-ink">{account.name}</span>
              <span className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] font-extrabold text-ink-muted">
                <span className="h-2 w-2 shrink-0 rounded-pill" style={{ background: account.dot }} aria-hidden />
                {account.role}
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

          {tools && (
            <RMenu.Item asChild>
              <Link href="/admin" className="pouf-menu__item">
                <Icon name="lab" size="sm" />
                Операторская
              </Link>
            </RMenu.Item>
          )}

          <RMenu.Separator className="pouf-menu__sep" />
          {/* Выход — server action формой, как в колонке: одна дверь наружу, один способ её открыть. */}
          <form action={logout}>
            <RMenu.Item asChild>
              <button type="submit" className="pouf-menu__item pouf-menu__item--down">
                <Icon name="logout" size="sm" />
                Выйти
              </button>
            </RMenu.Item>
          </form>
        </RMenu.Content>
      </RMenu.Portal>
    </RMenu.Root>
  );
}

/** Фото или монограмма — тот же аватар, что в колонке (app-sidebar.tsx). */
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
