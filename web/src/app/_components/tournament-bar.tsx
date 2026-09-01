"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DropdownMenu } from "@/components/pouf/menu";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { TOUCH_TARGET, useScrollActiveIntoView } from "./nav-scroll";

// Строка контекста турнира — вторая и последняя строка хрома внутри /tournaments/<slug>.
// В ней сразу два уровня навигации (UI-GUIDELINES §2):
//   L2 — какой турнир и какой дивизион (переключатель + сегменты);
//   L3 — какой этап внутри него (таблица / плей-офф / статистика / ростер / TP / о турнире).
// Отдельными строками их не разносим: L1 + L2 + L3 — это три ряда хрома, а до данных их
// разрешено два. Раньше на месте этой строки стояли два экрана плиток — хаб турнира и хаб
// дивизиона; они и были главной причиной, по которой до таблицы приходилось идти пятью кликами.

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
  return tail === "/playoff" || tail === "/stats" ? tail : "";
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
  const activeRef = useScrollActiveIntoView<HTMLAnchorElement>();

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
          { href: `${base}/playoff`, label: "Плей-офф", active: pathname === `${base}/playoff` },
          { href: `${base}/stats`, label: "Статистика", active: pathname === `${base}/stats` },
        ]
      : []),
    // На приёме заявок ростер турнира — это и есть заявленные команды (участники), поэтому
    // показываем одну вкладку под именем этапа: «Заявленные команды» вместо «Ростер». Данные и
    // страница разные, но обе читают участие (`TournamentEntry`), так что список совпадает.
    showEntrants
      ? { href: `${root}/entrants`, label: "Заявленные команды", active: pathname === `${root}/entrants` }
      : { href: `${root}/roster/teams`, label: "Ростер", active: pathname.startsWith(`${root}/roster`) },
    { href: `${root}/tp`, label: "TP", active: pathname === `${root}/tp` },
    { href: `${root}/about`, label: "О турнире", active: pathname === `${root}/about` },
  ];

  return (
    // 57px = высота верхней строки (h-14) вместе с её границей — иначе при скролле щель в 1px.
    <div
      className="sticky top-[57px] z-40 border-b border-hairline bg-canvas/85 font-pouf backdrop-blur"
    >
      <div className={`mx-auto flex ${SITE_MAX_W} items-center gap-2 overflow-x-auto px-4 py-2 md:px-6`}>
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

        {divisions.length > 1 &&
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
