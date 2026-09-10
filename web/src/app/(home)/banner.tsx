import Link from "next/link";
import { openForRegistration } from "@/lib/tournaments";
import { Hero } from "@/components/pouf/hero";
import { Icon, type IconName } from "@/components/pouf/Icon";
import { buttonClasses } from "@/components/pouf/Button";

// Баннер витрины — одно предложение действия, самое своевременное на сегодня. Не декоративная
// картинка: что показать, решают данные, поэтому баннер не врёт про открытый приём заявок, когда
// он закрыт, и не зовёт «вступить» того, кто уже вступил.
//
// Порядок такой: пока идёт приём заявок — зовём заявиться (это единственное действие лиги со
// сроком); нет приёма и человек не в лиге — зовём завести аккаунт; всё остальное — анонсы сезона
// на основном сайте.

const SITE = "https://leagueofspirits.ru/lost_s1";
const date = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long" });

function Banner({
  icon,
  eyebrow,
  title,
  text,
  cta,
}: {
  icon: IconName;
  eyebrow: string;
  title: string;
  text: string;
  cta: { href: string; label: string; external?: boolean };
}) {
  const button = buttonClasses();
  return (
    <Hero>
      <div className="relative flex flex-wrap items-center gap-5 px-5 py-6 sm:px-[30px]">
        {/* Значок с текстом — одной неразрывной частью: иначе на 390px кнопка остаётся в строке,
            а заголовок баннера ужимается до двух слов в строчку. */}
        <div className="flex min-w-[240px] flex-1 items-center gap-5">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[20px] bg-accent-fill text-[var(--on-accent)] cushion-blob">
            <Icon name={icon} size="lg" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold uppercase tracking-[1.6px] text-ink-subtle">{eyebrow}</p>
            <h2 className="mt-1 text-[22px] font-black leading-tight tracking-[-0.5px] text-ink sm:text-[26px]">
              {title}
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm font-bold leading-[1.55] text-ink-muted">{text}</p>
          </div>
        </div>
        {cta.external ? (
          <a href={cta.href} target="_blank" rel="noreferrer" className={button}>
            {cta.label}
          </a>
        ) : (
          <Link href={cta.href} className={button}>
            {cta.label}
          </Link>
        )}
      </div>
    </Hero>
  );
}

export async function HomeBanner({ guest }: { guest: boolean }) {
  // Приём идёт не у «текущего» турнира, а у следующего — правило одно на весь продукт.
  const open = await openForRegistration();

  if (open)
    return (
      <Banner
        icon="trophy"
        eyebrow="Приём заявок открыт"
        title={open.name}
        text={
          open.regCloseAt
            ? `Заявки принимаем до ${date.format(open.regCloseAt)}. Состав можно дозаявить позже — на старте важно занять место в сетке.`
            : "Заявки принимаются. Состав можно дозаявить позже — на старте важно занять место в сетке."
        }
        cta={{ href: `/tournaments/${open.slug}/apply`, label: "Заявить команду" }}
      />
    );

  if (guest)
    return (
      <Banner
        icon="users"
        eyebrow="Лига открыта"
        title="Заведите карточку игрока"
        text="Ранг, статистика матчей и место в зачёте TP — всё это появляется после того, как заявку примут. Команде проще заявить того, кто уже в ростере."
        cta={{ href: "/me", label: "Вступить в лигу" }}
      />
    );

  return (
    <Banner
      icon="send"
      eyebrow="Между сезонами"
      title="Анонсы следующего сезона"
      text="Приём заявок сейчас закрыт. Даты нового сезона, состав дивизионов и правила отбора объявляем на основном сайте лиги."
      cta={{ href: SITE, label: "На сайт лиги", external: true }}
    />
  );
}
