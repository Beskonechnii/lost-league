import type { Metadata } from "next";
import Link from "next/link";
import { currentTournament, getDivisions } from "@/lib/tournaments";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { Card } from "@/components/pouf/surface";
import { Heading, Eyebrow } from "@/components/pouf/text";

// Входная дверь продукта. До этого на `/` стояло поле ввода id матча — посетитель попадал
// в операторский инструмент и не понимал, куда пришёл. Здесь: что за лига и что тут можно сделать.
//
// Цифры берём из базы, а не пишем руками: подписи на витрине не должны расходиться с данными.
// Стиль — docs/brand/BRENDBOOK.md: тёмная тема, акцент violet-600.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description:
    "League of Spirit — киберспортивные турниры по Dota 2 в Минске. Таблица дивизиона, составы команд и разбор любого матча Dota 2.",
};

const SITE = "https://leagueofspirits.ru/lost_s1";

/**
 * Разделы продукта. Дивизионы сюда подставляются из текущего турнира (см. ниже), а не вписаны
 * руками: заведёшь новый сезон — карточки на лендинге сменятся сами.
 */
const SECTIONS = [
  {
    href: "/tournaments",
    title: "Турниры",
    text: "Сезоны и кубки лиги: регламент, сроки, дивизионы и заявленные составы. Отсюда — вход в таблицы конкретного дивизиона.",
    cta: "Открыть турниры",
    accent: "none",
  },
] as const;

type Section = { href: string; title: string; text: string; cta: string; accent: string };

export default async function Home() {
  const current = await currentTournament();
  const divisions = await getDivisions();
  // Карточка на дивизион + постоянные разделы. Акцент первых двух — цвета D1/D2, дальше нейтральный.
  // Ростера и админки здесь нет: ростер живёт внутри турнира и открывается из него, а служебную
  // часть держит вкладка «Админ» в шапке — на лендинге она дублировалась.
  const sections: Section[] = [
    ...divisions.map((d, i) => ({
      href: current ? `/tournaments/${current.slug}/${d.slug}` : "/tournaments",
      title: d.label,
      text: `Таблица с зонами выхода, сетка групповой стадии и плей-офф. Правка результата встречи двигает и сетку, и таблицу.`,
      cta: "Смотреть таблицу",
      accent: i === 0 ? "d1" : i === 1 ? "d2" : "none",
    })),
    ...SECTIONS,
  ];

  return (
    <main className="flex-1 font-pouf">
      {/* Первый экран: одно название лиги */}
      <section className="relative overflow-hidden border-b border-hairline">
        {/* фирменное свечение — бренд-фиолетовый LOST */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-d1/25 to-d2/15 blur-3xl"
        />
        <div className={`relative mx-auto ${SITE_MAX_W} px-4 py-16 md:px-6 md:py-24`}>
          {/* Только название лиги: подзаголовки, кнопки и цифры ушли — вход в разделы ниже,
              дублировать его первым экраном незачем.
              display-тип: плотный line-height + отрицательный трекинг — «голос» pouf */}
          <h1 className="text-5xl font-black uppercase leading-[1.05] tracking-[-0.03em] text-ink md:text-7xl">
            League of Spirit
          </h1>
        </div>
      </section>

      {/* Разделы: карточка = пункт меню, чтобы «что тут вообще есть» читалось без клика.
          Возвышение — «подушка» pouf, при наведении карточка приподнимается (motion=lift). */}
      <section className={`mx-auto ${SITE_MAX_W} px-4 py-12 md:px-6 md:py-16`}>
        <Eyebrow>Разделы</Eyebrow>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sections.map((s) => (
            <Link key={s.href} href={s.href} className="group block">
              <Card motion="lift">
                <div className="flex h-full flex-col gap-3">
                  <Heading level={3}>{s.title}</Heading>
                  <p className="flex-1 text-sm font-bold leading-relaxed text-muted">{s.text}</p>
                  <span className="inline-flex items-center gap-1 text-sm font-black text-[var(--accent-ink)]">
                    {s.cta}
                    <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        <p className="mt-10 text-sm font-bold text-muted">
          Основной сайт лиги и анонсы сезона —{" "}
          <a href={SITE} target="_blank" rel="noreferrer" className="text-[var(--accent-ink)] hover:underline">
            leagueofspirits.ru
          </a>
          .
        </p>
      </section>
    </main>
  );
}
