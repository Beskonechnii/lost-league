import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentTournament, openForRegistrationAll } from "@/lib/tournaments";
import { SectionHeader, SITE_MAX_W } from "@/components/pouf/blocks";
import { Icon } from "@/components/pouf/Icon";

// Заявка подаётся в конкретный турнир (/tournaments/<slug>/apply, TOURNAMENTS-PLAN.md).
// Общий /apply — сборный пункт для тех, кто пришёл не с карточки турнира, поэтому спрашиваем,
// куда сейчас правда можно подать (`openForRegistrationAll` — там же учтён срок приёма).
//
// Открытых наборов может быть несколько (два сезона рядом): тогда турнир выбирает человек, а не
// угадывает страница (ТЗ 23). Угаданный редирект в этом случае уводил вторую половину капитанов
// не в тот турнир — молча и без возможности заметить.
//
// Не нашли ни одного — ведём на страницу текущего турнира со сроками: она полезнее пустой формы.

export const dynamic = "force-dynamic";

// Служебное перенаправление, а не страница раздела: в выдаче ему делать нечего, ссылки со списка
// турниров поисковик обойдёт и без него.
export const metadata = { title: "Заявить команду", robots: { index: false, follow: true } };

const date = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long" });

export default async function ApplyRedirect() {
  const open = await openForRegistrationAll();
  if (open.length === 1) redirect(`/tournaments/${open[0].slug}/apply`);

  if (open.length === 0) {
    const current = await currentTournament();
    if (!current) notFound();
    redirect(`/tournaments/${current.slug}/about`);
  }

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 font-pouf md:px-6`}>
      <SectionHeader eyebrow="Заявка" title="Куда заявить команду" />
      <p className="mt-(--s4) text-sm font-bold text-muted">
        Приём открыт не в одном турнире — выберите свой, дальше форма та же.
      </p>

      <div className="mt-(--s5) grid gap-3 sm:grid-cols-2">
        {open.map((t) => (
          <Link
            key={t.id}
            href={`/tournaments/${t.slug}/apply`}
            className="flex items-center justify-between gap-3 rounded-card bg-surface px-(--s5) py-(--s4) cushion-card transition hover:text-[var(--accent-ink)]"
          >
            <span className="min-w-0">
              <span className="block text-lg font-black tracking-[-0.5px]">{t.name}</span>
              <span className="mt-1 block text-xs font-extrabold uppercase tracking-[0.8px] text-ink-subtle">
                {t.regCloseAt ? `Приём заявок до ${date.format(t.regCloseAt)}` : "Приём заявок открыт"}
              </span>
            </span>
            <Icon name="next" size="sm" />
          </Link>
        ))}
      </div>
    </main>
  );
}
