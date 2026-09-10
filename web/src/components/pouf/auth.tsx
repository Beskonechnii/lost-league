import type { ReactNode } from "react";
import { AUTH_MAX_W } from "./blocks";

/* Окно входа — оболочка из канонического макета «Вход»: одинокая подушка по
 * центру пустой страницы, марочная шапка (знак с названием, под ними заголовок) сверху.
 *
 * Заведено атомом на Э8, потому что окон стало два: кабинет `/me` (почта,
 * пароль, регистрация, анкета) и вход по коду из бота `/login/tg`. До этого
 * оболочку держал у себя `login/tg/page.tsx`, и второй экран её бы скопировал —
 * ровно тот случай, когда «одна и та же карточка» через месяц едет по-разному.
 *
 * Знак вместо буквы в мятном квадрате — решение Э3b: у бренда своя лента, и
 * рисовать её градиентом значит держать вторую версию логотипа в классах.
 */

/**
 * Подушка окна входа. `wide` — колонка квиза: у анкеты поля идут парами
 * (имя/фамилия, город/страна), и на 420px пара не помещается.
 */
export function AuthCard({
  title,
  wide = false,
  corner,
  children,
}: {
  title: ReactNode;
  wide?: boolean;
  /** Правый верхний угол карточки — выход из мастера, «выйти» и т.п. */
  corner?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="flex-1 px-4 py-10 font-pouf md:py-16">
      <div
        className={`relative mx-auto w-full ${wide ? "max-w-[560px]" : AUTH_MAX_W} rounded-[36px] bg-surface px-6 pb-7 pt-8 cushion-card sm:px-8`}
      >
        {corner && <div className="absolute right-5 top-5 z-10">{corner}</div>}
        <div className="mb-6 flex flex-col items-center gap-3.5">
          {/* Знак и название — ОДНИМ блоком, как в сайдбаре и подвале (Э18). До этого знак стоял
              сверху, а название шло подписью ПОД заголовком страницы — между ними оказывался
              «Вход в лигу», и марка читалась не маркой, а двумя случайными строчками.
              Название — маска по wordmark.svg, а не текст: шрифт логотипа в проект не вендорен,
              а набранная им строка была бы третьей версией одного и того же слова. */}
          <span className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/brand/mark.svg" alt="" aria-hidden className="h-12 w-auto" />
            <span
              role="img"
              aria-label="SPIRIT/CTRL"
              className="h-[19px] w-[155px] shrink-0 bg-ink [mask:url(/assets/brand/wordmark.svg)_center/contain_no-repeat]"
            />
          </span>
          <h1 className="text-center text-[22px] font-black tracking-[-0.5px] text-ink">{title}</h1>
        </div>
        {children}
      </div>
    </main>
  );
}

/** Разделитель «или через» из макета: отделяет основной способ входа от запасного. */
export function AuthDivider({ children }: { children: ReactNode }) {
  return (
    <div className="my-5 flex items-center gap-3.5 text-[11px] font-extrabold uppercase tracking-[1px] text-muted before:h-px before:flex-1 before:bg-hairline after:h-px after:flex-1 after:bg-hairline">
      {children}
    </div>
  );
}
