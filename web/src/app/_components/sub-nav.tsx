"use client";

import { usePathname } from "next/navigation";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { PillLink } from "@/components/pouf/tabs";
import { useScrollActiveIntoView } from "./nav-scroll";

// Ряд подвкладок раздела (уровень L3 стандарта). Раньше жил в site-nav.tsx рядом с верхней строкой
// сайта; строки больше нет — сайдбар взял на себя всю глобальную навигацию (DECISIONS, 02.09), —
// а подвкладки остались: они выбирают этап внутри одного раздела, а не раздел.
//
// Липнет к верху окна (top-0), а не к строке под шапкой: над содержимым больше ничего нет.

// match — дополнительные префиксы, при которых пункт считается активным. Нужно вкладке, которая в URL
// живёт не под своим href.
export type NavItem = { href: string; label: string; hint?: string; match?: string[] };

/** Активен раздел, если путь совпадает или лежит внутри него («/» — только точное совпадение). */
function matchesHref(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Насколько точно пункт подходит пути — длина совпавшего префикса, 0 = не подходит. Точность нужна
 * потому, что вкладки вложены: подсветиться должна одна — самая конкретная.
 */
function matchScore(pathname: string, item: NavItem) {
  const all = [item.href, ...(item.match ?? [])].filter((h) => matchesHref(pathname, h));
  return all.reduce((best, h) => Math.max(best, h.length), 0);
}

/** Подразделы секции (студия). Подсвечивается самый конкретный подходящий пункт. */
export function SubNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const activeRef = useScrollActiveIntoView<HTMLAnchorElement>();
  const active = items
    .map((t) => ({ href: t.href, score: matchScore(pathname, t) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.href;

  return (
    <div className="sticky top-0 z-40 border-b border-hairline bg-canvas/85 font-pouf backdrop-blur">
      <nav className={`mx-auto flex ${SITE_MAX_W} gap-2 overflow-x-auto px-4 py-2 md:px-6`}>
        {items.map((t) => (
          <PillLink
            key={t.href}
            ref={t.href === active ? activeRef : undefined}
            href={t.href}
            title={t.hint}
            active={t.href === active}
            size="md"
            variant="quiet"
          >
            {t.label}
          </PillLink>
        ))}
      </nav>
    </div>
  );
}
