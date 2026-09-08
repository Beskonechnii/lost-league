"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DropdownMenu } from "@/components/pouf/menu";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { TOUCH_TARGET, useScrollActiveIntoView } from "./nav-scroll";

// Строка контекста турнира — единственная строка хрома внутри /tournaments/<slug>.
// В ней сразу два уровня навигации (UI-GUIDELINES §2):
//   L2 — какой турнир и какой дивизион (переключатель + сегменты);
//   L3 — какой этап внутри него (таблица / плей-офф / статистика / ростер / TP / о турнире).
// Отдельными строками их не разносим: два ряда над данными вместо одного ничего не добавляют.
// Раньше на месте этой строки стояли два экрана плиток — хаб турнира и хаб дивизиона; они и были
// главной причиной, по которой до таблицы приходилось идти пятью кликами.
//
// Глобального уровня L1 в ней нет: с Э4b он целиком в сайдбаре слева.

export type BarDivision = { slug: string; short: string };
export type BarTournament = { slug: string; name: string; status: string };

const focus = "outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]";

/** Пилюля строки: активная вжата внутрь, спокойная поднимается на hover. Один вид на L2 и L3 —
 *  разделяет их не форма, а разделитель между группами. */
function pill(active: boolean) {
  return `inline-flex shrink-0 rounded-[14px] px-3.5 py-[9px] text-[13px] font-black transition-[box-shadow,transform,background] ${TOUCH_TARGET} ${focus} ${
    active
      ? "bg-accent-fill text-[var(--on-accent)] cushion-control"
      : "text-ink-muted hover:bg-surface-1 hover:text-ink hover:cushion-field"
  }`;
}

/**
 * Этап, на котором стоим, — по хвосту пути после дивизиона. Нужен, чтобы переключение дивизиона
 * не сбрасывало на таблицу: из плей-офф D1 уходим в плей-офф D2, а не на корень.
 */
function stageSuffix(pathname: string, base: string) {
  if (!pathname.startsWith(`${base}/`)) return "";
  const tail = pathname.slice(base.length);
  return tail === "/groups" || tail === "/playoff" || tail === "/stats" ? tail : "";
}

export function TournamentBar({
  slug,
  name,
  divisions,
  tournaments,
  showEntrants = false,
}: {
  slug: string;
  name: string;
  divisions: BarDivision[];
  /** Остальные турниры для переключателя. Пустой список — переключатель рисуется как простая метка. */
  tournaments: BarTournament[];
  /** Показать вкладку «Заявленные команды» — только на этапе приёма заявок. */
  showEntrants?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Ряд проматывается вбок, а его начало липкое — значит, промотка обязана оставлять под липким
  // блоком место, иначе активная вкладка уезжает под переключатель турнира. Ширину блока меряем,
  // а не пишем числом: она зависит от имени турнира. Слой `useLayoutEffect` здесь не украшение —
  // он гарантированно отрабатывает раньше промотки из `useScrollActiveIntoView` (та на `useEffect`).
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const sticky = stickyRef.current;
    if (!scroller || !sticky) return;
    const measure = () => {
      scroller.style.scrollPaddingLeft = `${sticky.offsetWidth}px`;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(sticky);
    return () => ro.disconnect();
  }, []);

  const activeRef = useScrollActiveIntoView<HTMLAnchorElement>("nearest");

  const root = `/tournaments/${slug}`;
  // Дивизион берём из пути; если стоим на общем разделе турнира (ростер, TP, о турнире) — первый.
  // Совсем без дивизионов турнир тоже бывает (заведён, жеребьёвки ещё нет) — тогда этапов нет.
  const inDiv = divisions.find((d) => pathname === `${root}/${d.slug}` || pathname.startsWith(`${root}/${d.slug}/`));
  const div = inDiv ?? divisions[0];
  const base = div ? `${root}/${div.slug}` : root;
  const suffix = div ? stageSuffix(pathname, base) : "";

  // Вкладки этапа. Первые три принадлежат дивизиону, остальные — турниру целиком; активной может
  // быть только одна, поэтому сравниваем полным путём, а не префиксом (кроме ростера — у него внутри
  // ещё команды/игроки).
  const stages = [
    ...(div
      ? [
          { href: base, label: "Таблица", active: pathname === base },
          // «Группы» вернулись отдельной вкладкой на Э5: корень дивизиона показывает таблицу,
          // а кросс-сетка личных встреч — экран со своей шириной (UI-GUIDELINES §2, L3).
          { href: `${base}/groups`, label: "Группы", active: pathname === `${base}/groups` },
          { href: `${base}/playoff`, label: "Плей-офф", active: pathname === `${base}/playoff` },
          { href: `${base}/stats`, label: "Статистика", active: pathname === `${base}/stats` },
        ]
      : []),
    // Вкладка называется «Составы», а не «Ростер»: «Ростер» уже занят пунктом сайдбара, который
    // ведёт на сквозной пул команд лиги (/roster). Одно слово на два разных экрана — и человек не
    // понимает, почему список другой; здесь речь именно о составах, заявленных в этот турнир.
    //
    // На приёме заявок это и есть заявленные команды (участники), поэтому показываем одну вкладку
    // под именем этапа: «Заявленные команды». Данные и страница разные, но обе читают участие
    // (`TournamentEntry`), так что список совпадает.
    showEntrants
      ? { href: `${root}/entrants`, label: "Заявленные команды", active: pathname === `${root}/entrants` }
      : { href: `${root}/roster/teams`, label: "Составы", active: pathname.startsWith(`${root}/roster`) },
    { href: `${root}/tp`, label: "TP", active: pathname === `${root}/tp` },
    { href: `${root}/about`, label: "О турнире", active: pathname === `${root}/about` },
  ];

  return (
    // Липнет к верху окна: верхней строки сайта над содержимым больше нет — вся глобальная
    // навигация уехала в сайдбар (DECISIONS, 02.09), и эта строка стала единственным рядом хрома.
    <div className="sticky top-0 z-40 border-b border-hairline bg-canvas/85 font-pouf backdrop-blur">
      {/* Отступ слева отдан липкому блоку (ниже), а не строке: у строки его быть не может — в этом
          зазоре видны проезжающие под ним вкладки. */}
      <div ref={scrollerRef} className={`mx-auto flex ${SITE_MAX_W} items-center gap-2 overflow-x-auto py-2 pr-4 md:pr-6`}>
        {/* Переключатель турнира липнет к левому краю строки. Строка проматывается вбок (на телефоне
            всегда), а активная вкладка ещё и сама проматывается в вид — и утаскивала имя турнира за
            край: на 375px первым, что видно, оказывалось «D1 D2 | Таблица», а какой это турнир,
            из хрома не читалось (UI-GUIDELINES §0, принцип 4 — «где я» видно из хрома).
            Своя заливка обязательна: под липким элементом проезжают вкладки. */}
        <div
          ref={stickyRef}
          className="sticky left-0 z-10 -my-2 flex shrink-0 items-center bg-canvas py-2 pl-4 pr-2 md:pl-6"
        >
        {tournaments.length > 0 ? (
          <DropdownMenu
            label="Выбрать турнир"
            items={tournaments.map((t) => ({
              label: t.name,
              onClick: () => router.push(`/tournaments/${t.slug}`),
            }))}
          >
            <button type="button" className={`${pill(false)} bg-surface-1 text-ink cushion-field`}>
              {name} <span aria-hidden className="ml-1 text-ink-muted">▾</span>
            </button>
          </DropdownMenu>
        ) : (
          <span className="shrink-0 px-1 text-[13px] font-black text-ink">{name}</span>
        )}
        </div>

        {/* Сегменты дивизионов показываем только там, где дивизион есть в адресе (таблица, плей-офф,
            статистика). На общих разделах турнира — ростер, TP, «О турнире» — они ни на что не влияют:
            активного среди них нет, а нажатие уводит в таблицу, то есть с текущего этапа. Хуже того,
            на ростере рядом стоит его собственный фильтр `D1 · D2 · Все`, и на экране оказывались два
            ряда дивизионов за разные действия — это прямой антипаттерн из UI-GUIDELINES §9. */}
        {inDiv &&
          divisions.length > 1 &&
          divisions.map((d) => (
            <Link
              key={d.slug}
              href={`${root}/${d.slug}${suffix}`}
              aria-current={inDiv?.slug === d.slug ? "page" : undefined}
              className={pill(inDiv?.slug === d.slug)}
            >
              {d.short}
            </Link>
          ))}

        <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-hairline" />

        <nav className="flex gap-2">
          {stages.map((s) => (
            <Link
              key={s.href}
              ref={s.active ? activeRef : undefined}
              href={s.href}
              aria-current={s.active ? "page" : undefined}
              className={pill(s.active)}
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
