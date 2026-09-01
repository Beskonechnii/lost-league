"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ToolGroup } from "./tools";
import { QUEUE_TOOL } from "./tools";
import { TOUCH_TARGET, useScrollActiveIntoView } from "@/app/_components/nav-scroll";

// Постоянный список инструментов операторской. Пришёл на смену связке «плитки + кнопка Назад»:
// у оператора не просмотр, а работа с полутора десятками инструментов, и переход между двумя из них
// шёл через хаб — то есть через экран, на котором нет работы (UI-GUIDELINES §5).
//
// На широком экране это левая колонка; ниже lg колонка не влезает и превращается в один
// горизонтально прокручиваемый ряд пилюль — тот же список, та же подсветка, без отдельного меню
// и без состояния, которое пришлось бы синхронизировать.

const focus = "outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]";

/** Активен инструмент, если путь совпал или лежит внутри него (у студии и архива есть вложенные страницы). */
const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export function AdminSidebar({ groups, pending }: { groups: ToolGroup[]; pending: number }) {
  const pathname = usePathname();
  // В мобильном ряду активный инструмент так же легко оказывается за краем, как вкладка турнира.
  const activeRef = useScrollActiveIntoView<HTMLAnchorElement>();

  return (
    <aside
      className="font-pouf lg:sticky lg:top-[57px] lg:h-[calc(100dvh-57px)] lg:w-60 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-hairline"
    >
      <nav className="flex gap-2 overflow-x-auto border-b border-hairline px-4 py-2 lg:flex-col lg:gap-5 lg:border-b-0 lg:px-3 lg:py-4">
        {groups.map((g) => (
          <div key={g.title} className="flex shrink-0 gap-2 lg:flex-col lg:gap-1">
            {/* Заголовок группы нужен там, где пункты стоят столбцом; в мобильном ряду он только съедал бы место */}
            <h2 className="hidden px-3 text-[11px] font-black uppercase tracking-[0.18em] text-muted lg:block">
              {g.title}
            </h2>
            {g.tools.map((t) => {
              const active = isActive(pathname, t.href);
              return (
                <Link
                  key={t.href}
                  ref={active ? activeRef : undefined}
                  href={t.href}
                  title={t.desc}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-2 rounded-[14px] px-3 py-[9px] text-[13px] font-black transition-[box-shadow,transform,background] ${TOUCH_TARGET} ${focus} ${
                    active
                      ? "bg-accent-fill text-[var(--on-accent)] cushion-control"
                      : "text-ink-muted hover:bg-surface-1 hover:text-ink hover:cushion-field"
                  }`}
                >
                  <span aria-hidden>{t.icon}</span>
                  <span className="truncate">{t.label}</span>
                  {t.soon && <span className="ml-auto text-[10px] font-bold text-muted">скоро</span>}
                  {/* Очередь модерации: её легко пропустить, если о ней ничего не напоминает */}
                  {t.href === QUEUE_TOOL && pending > 0 && (
                    <span className="ml-auto rounded-pill bg-amber-500/20 px-2 text-[11px] font-black text-amber-700">
                      {pending}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
