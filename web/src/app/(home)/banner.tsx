import Link from "next/link";
import Image from "next/image";
import { openForRegistration } from "@/lib/tournaments";
import { homeBanner } from "@/lib/home-banner-store";
import { Hero } from "@/components/pouf/hero";
import { Icon, type IconName } from "@/components/pouf/Icon";
import { buttonClasses } from "@/components/pouf/Button";

// Герой витрины — левая половина верхнего ряда по макету `design/home/Main.dc.html`: полотно
// сверху, под ним надпись и одно действие.
//
// Содержание прежнее и по-прежнему решают данные, а не редактор: пока идёт приём заявок — зовём
// заявиться (это единственное действие лиги со сроком); нет приёма и человек не в лиге — зовём
// завести аккаунт; всё остальное — анонсы сезона на основном сайте. Поэтому герой не врёт про
// открытый приём, когда он закрыт, и не зовёт «вступить» того, кто уже вступил.
//
// На полотне стоит имя лиги: у макета там «графика новости», раздела новостей в проекте нет, а
// первый экран обязан назвать, куда человек попал (и это единственный h1 страницы).
//
// С ТЗ 25 у полотна появился второй хозяин — баннер, заданный оператором в /admin/banner. Он
// перекрывает ветку по данным ЦЕЛИКОМ и только целиком: заполнен наполовину или выключен —
// работают данные, потому что чужой заголовок над чужой кнопкой хуже отсутствия афиши.

const SITE = "https://leagueofspirits.ru/lost_s1";
const date = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long" });

function Banner({
  icon,
  eyebrow,
  image,
  title,
  text,
  cta,
}: {
  icon?: IconName;
  eyebrow?: string;
  /** Картинка оператора вместо акцентной плашки. */
  image?: string;
  title: string;
  text: string;
  cta: { href: string; label: string; external?: boolean };
}) {
  const button = buttonClasses();
  return (
    <Hero className="flex h-full flex-col gap-[18px] p-[22px]">
      {/* Полотно героя: 300px из макета на широком, ниже — на телефоне, где оно съело бы экран.
          Высоту держим и под картинкой: она держит высоту всего верхнего ряда витрины. */}
      <div
        className={`relative grid h-[170px] shrink-0 place-items-center gap-3 overflow-hidden rounded-card text-center cushion-control sm:h-[300px] ${
          image ? "" : "bg-accent-fill px-6 text-[var(--on-accent)]"
        }`}
      >
        {image && (
          // Полотно декоративное: смысл несёт заголовок рядом, поэтому alt пустой. Это LCP
          // первого экрана — грузим с приоритетом и без клиентского дозапроса. `object-cover`,
          // а не `contain`: полотно меняет пропорции от 1,85 до 3,24, полей в Light Clay нет.
          <Image
            src={image}
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) calc(100vw - 467px), calc(100vw - 76px)"
            className="object-cover object-center"
          />
        )}
        {/* Имя лиги. Под картинкой оно уходит в `sr-only` целиком: единственный h1 страницы
            обязан остаться, но рисовать его поверх афиши нечем, а дублировать видимой строкой
            нельзя — читалка прочитает дважды. */}
        <div className={image ? "sr-only" : undefined}>
          {icon && !image && <Icon name={icon} size="lg" />}
          <h1 className="mt-2 text-[28px] font-black uppercase leading-none tracking-[-1px] sm:text-[44px]">
            SPIRIT/CTRL
          </h1>
          <p className="mt-2 text-[11px] font-extrabold uppercase tracking-[1.6px] text-[var(--on-accent-muted)]">
            Киберспортивная лига · Минск
          </p>
        </div>
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col gap-2.5 px-2 pb-1">
        {eyebrow && <p className="text-[11px] font-extrabold uppercase tracking-[1.6px] text-ink-subtle">{eyebrow}</p>}
        {/* Клампы — сетка под полями оператора: неудачный словораздел режет хвост, а не ломает
            высоту верхнего ряда. */}
        <h2 className="line-clamp-2 text-[22px] font-black leading-[1.15] tracking-[-0.8px] text-ink sm:text-[28px]">{title}</h2>
        <p className="line-clamp-4 max-w-[560px] text-sm font-bold leading-[1.5] text-ink-muted">{text}</p>
        {/* Кнопка прижата к низу: высоты героя и карточки игрока в ряду равны, и пустота между
            текстом и действием не должна собираться посередине. */}
        <div className="mt-auto pt-2">
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
      </div>
    </Hero>
  );
}

export async function HomeBanner({ guest }: { guest: boolean }) {
  // Баннер оператора — первым: он старше данных, если задан целиком и включён.
  const own = await homeBanner();
  if (own)
    return (
      <Banner
        image={own.image}
        title={own.title}
        text={own.text}
        cta={own.cta}
      />
    );

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
