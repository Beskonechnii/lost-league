import Link from "next/link";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { Icon } from "@/components/pouf/Icon";

// Низ каждой страницы продукта — по канону Кита «Футер» (design/kit/build.mjs), колонка в колонку.
// Ссылок на несуществующие разделы в самом футере нет — они ведут на честные заглушки
// «страница в разработке» (see app/_components/coming-soon.tsx), а не на 404 или на подмену
// другого раздела.

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Турниры",
    links: [
      { href: "/tournaments", label: "Текущий сезон" },
      { href: "/tournaments/archive", label: "Архив сезонов" },
      { href: "/schedule", label: "Расписание" },
      { href: "/playoffs", label: "Плей-офф" },
    ],
  },
  {
    title: "Участникам",
    links: [
      { href: "/rules", label: "Правила лиги" },
      { href: "/apply", label: "Заявка на турнир" },
      { href: "/roster", label: "Команды" },
      { href: "/players", label: "Игроки" },
    ],
  },
  {
    title: "Лига",
    links: [
      { href: "/about", label: "О проекте" },
      { href: "/partners", label: "Партнёрам" },
      { href: "/contact", label: "Связаться" },
      { href: "/media-kit", label: "Медиакит" },
    ],
  },
];

// Соцсети лиги ещё не заведены (нет ни каналов, ни пабликов) — значки стоят по рисунку Кита, но
// не ссылки: битая кнопка хуже отсутствующей.
const SOCIAL_ICONS = ["send", "play", "user"] as const;

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className={`mx-auto w-full ${SITE_MAX_W} px-4 pb-8 md:px-6`}>
      <div className="cushion-card rounded-[38px] bg-surface p-8 md:p-9">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex min-w-0 shrink items-center gap-2.5" title="LOST — на главную">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/brand/mark.svg" alt="" aria-hidden className="h-8 w-auto" />
              <span
                role="img"
                aria-label="SPIRIT/CTRL"
                className="h-[15px] w-[122px] shrink-0 bg-ink [mask:url(/assets/brand/wordmark.svg)_center/contain_no-repeat]"
              />
            </Link>
            <p className="mt-3 max-w-[280px] text-[13px] font-bold leading-relaxed text-ink-muted">
              Любительская лига по Dota 2: сезонные турниры, дивизионы, разбор матчей и рейтинг игроков.
            </p>
            <div className="mt-4 flex gap-2.5">
              {SOCIAL_ICONS.map((icon, i) => (
                <span
                  key={i}
                  aria-hidden
                  className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-pill bg-surface-2 text-ink-subtle cushion-row"
                >
                  <Icon name={icon} size="sm" />
                </span>
              ))}
            </div>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="mb-3 text-[11px] font-extrabold uppercase tracking-[1.4px] text-ink-subtle">{col.title}</h3>
              <ul className="flex flex-col">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="block py-[7px] text-[14px] font-extrabold text-ink-muted transition hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-hairline pt-4 text-[12px] font-extrabold text-ink-subtle">
          <span>© {year} SPIRIT/CTRL</span>
          <span className="flex gap-4 sm:ml-auto">
            <Link href="/rules" className="transition hover:text-ink">
              Правила
            </Link>
            <Link href="/privacy" className="transition hover:text-ink">
              Конфиденциальность
            </Link>
            <Link href="/contact" className="transition hover:text-ink">
              Контакты
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
