"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_MAX_W } from "./ui";
import { TOUCH_TARGET, useScrollActiveIntoView } from "./nav-scroll";

// Навигация. Две верхние строки, по одной на группу маршрутов:
//   PublicNav — продукт (src/app/(public)): разбор матча, таблица, витрина ростера;
//   AdminNav  — служебная часть (src/app/(admin)): студия и правка ростера.
// Вторая строка (SubNav) — подразделы конкретной секции, подключается её layout'ом.
//
// Разделять важно не ради красоты: пока навигация была общей, посетитель видел в меню студию
// и админку, а оператор не видел границы между «это увидят все» и «это только моё».

// match — дополнительные префиксы, при которых пункт считается активным. Нужно секции, которая в URL
// живёт не под своим href: вкладка турнира ведёт на его хаб, но подсвечивается и на /roster.
export type NavItem = { href: string; label: string; hint?: string; match?: string[] };

// Верхняя строка: продукт (LOST S2) видят все, операторская (Админ) — только админы/владелец.
// Обе группы маршрутов рисуют эти же вкладки, поэтому переход между ними бесшовный: строка
// не меняется, меняется только второй ряд (подвкладки сезона / инструменты админки).
/**
 * Единственная продуктовая вкладка. Отдельной вкладки «текущий сезон» больше нет: всё, что
 * относится к турниру — дивизионы, таблицы, ростер — живёт внутри него (/tournaments/<slug>/…),
 * и две вкладки, ведущие в одно и то же место, только путали. Ростер и встречи подсвечивают её же:
 * они принадлежат сезону, хотя карточки команд и игроков лежат по общим адресам.
 */
const TOURNAMENTS_SECTION: NavItem = {
  href: "/tournaments",
  label: "Турниры",
  hint: "Сезоны и кубки лиги: таблицы, сетка, составы",
  match: ["/tournaments", "/standings", "/roster", "/series", "/tp"],
};
const ADMIN_SECTION: NavItem = {
  href: "/admin",
  label: "Админ",
  hint: "Операторская: серии, студия, драфты, разбор матча",
  match: ["/admin", "/studio", "/underbeer", "/match"],
};

/** Активен раздел, если путь совпадает или лежит внутри него («/» — только точное совпадение). */
function matchesHref(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Насколько точно пункт подходит пути — длина совпавшего префикса, 0 = не подходит. Точность нужна
 * потому, что вкладки вложены: `/tournaments/s2` подходит и «Турниры», и вкладке сезона, а
 * подсветиться должна одна — самая конкретная (тот же приём, что в SubNav).
 */
function matchScore(pathname: string, item: NavItem) {
  const all = [item.href, ...(item.match ?? [])].filter((h) => matchesHref(pathname, h));
  return all.reduce((best, h) => Math.max(best, h.length), 0);
}

const focus = "outline-none focus-visible:ring-[3px] focus-visible:ring-purple";

/** Общая раскладка верхней строки — отличаются только наполнением и акцентом.
 *  Визуал 1st-Pouf: пилюли-«подушки», Nunito, лого-Blob. Активный раздел вжат внутрь
 *  (cushion-control), неактивный — тихий контур, поднимается на hover. */
function Bar({
  sections,
  brand,
  aside,
}: {
  sections: NavItem[];
  brand: React.ReactNode;
  aside: React.ReactNode;
}) {
  const pathname = usePathname();
  // Подсвечиваем ровно одну вкладку — ту, чей адрес совпал с путём точнее прочих.
  const active = sections
    .map((s) => ({ href: s.href, score: matchScore(pathname, s) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.href;

  return (
    <header className="pouf-lost sticky top-0 z-50 border-b border-hairline bg-canvas/85 font-pouf backdrop-blur" data-theme="dark">
      <div className={`mx-auto flex h-14 ${SITE_MAX_W} items-center gap-4 px-4 md:px-6`}>
        {brand}

        <nav className="-mx-1 flex flex-1 gap-2 overflow-x-auto px-1 py-2">
          {sections.map((s) => {
            const current = s.href === active;
            return (
              <Link
                key={s.href}
                href={s.href}
                title={s.hint}
                aria-current={current ? "page" : undefined}
                className={`inline-flex shrink-0 rounded-[14px] px-4 py-[9px] text-[13px] font-black transition-[box-shadow,transform,background] ${TOUCH_TARGET} ${focus} ${
                  current
                    ? "bg-purple text-[var(--on-accent)] cushion-control"
                    : "text-ink-muted hover:bg-surface-1 hover:text-ink hover:cushion-field"
                }`}
              >
                {s.label}
              </Link>
            );
          })}
        </nav>

        {aside}
      </div>
    </header>
  );
}

/**
 * Логотип-ссылка на главную — один для всего сайта: знак плюс вордмарк SPIRIT/CTRL.
 *
 * Картинками, а не текстом и блобом: у знака свой градиент, а у вордмарка — своя гарнитура, и ни то,
 * ни другое интерфейсными токенами не собрать. Подложки под знаком нет намеренно — он сам цветной,
 * и `cushion-blob` под ним превращался в кашу.
 *
 * `<img>`, а не `next/image`: обе картинки — векторные ассеты релиза рядом с кодом, оптимизировать
 * в них нечего, а лоадер добавил бы кадр пустоты в шапке на каждой навигации.
 */
const brand = (
  <Link href="/" className={`flex shrink-0 items-center gap-2.5 rounded-control ${focus}`} title="SPIRIT/CTRL">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/assets/brand/mark.svg" alt="" aria-hidden className="h-8 w-auto" />
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/assets/brand/wordmark.svg" alt="SPIRIT/CTRL" className="hidden h-[15px] w-auto sm:block" />
  </Link>
);

/** Справа — единственный вход: личный кабинет (там же логин через Google). Один на весь сайт. */
const cabinetLink = (
  <Link
    href="/me"
    title="Личный кабинет"
    className={`shrink-0 rounded-md border border-hairline px-3 py-1.5 text-xs text-ink-muted transition-colors hover:border-accent hover:text-ink ${focus}`}
  >
    Кабинет
  </Link>
);

// Верхняя строка: продукт всем, «Админ» — только админам (роль приходит из layout'а). PublicNav/AdminNav
// оставлены отдельными функциями лишь потому, что их зовут разные layout'ы — содержимое у них общее.
function TopBar({ isAdmin }: { isAdmin: boolean }) {
  const sections = isAdmin ? [TOURNAMENTS_SECTION, ADMIN_SECTION] : [TOURNAMENTS_SECTION];
  return <Bar sections={sections} brand={brand} aside={cabinetLink} />;
}

/** Навигация продукта (группа public). `isAdmin` управляет видимостью вкладки «Админ». */
export function PublicNav({ isAdmin }: { isAdmin: boolean }) {
  return <TopBar isAdmin={isAdmin} />;
}

/** Навигация служебной части (группа admin) — та же верхняя строка, что и у продукта. */
export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  return <TopBar isAdmin={isAdmin} />;
}

/** Подразделы секции (ростер, студия). Подсвечивается самый конкретный подходящий пункт. */
export function SubNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const activeRef = useScrollActiveIntoView<HTMLAnchorElement>();
  const active = items
    .map((t) => ({ href: t.href, score: matchScore(pathname, t) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.href;

  return (
    // 57px = высота верхней строки (h-14) вместе с её нижней границей — иначе при скролле щель в 1px
    <div className="pouf-lost sticky top-[57px] z-40 border-b border-hairline bg-canvas/85 font-pouf backdrop-blur" data-theme="dark">
      <nav className={`mx-auto flex ${SITE_MAX_W} gap-2 overflow-x-auto px-4 py-2 md:px-6`}>
        {items.map((t) => (
          <Link
            key={t.href}
            ref={t.href === active ? activeRef : undefined}
            href={t.href}
            title={t.hint}
            aria-current={t.href === active ? "page" : undefined}
            className={`inline-flex shrink-0 rounded-[14px] px-4 py-[9px] text-[13px] font-black transition-[box-shadow,transform,background] ${TOUCH_TARGET} ${focus} ${
              t.href === active
                ? "bg-purple text-[var(--on-accent)] cushion-control"
                : "text-ink-muted hover:bg-surface-1 hover:text-ink hover:cushion-field"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
