import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/pouf/Icon";

// Подложка смыслового блока витрины — аннотация `n-slab` макета `design/home/Main.dc.html`.
//
// Турниры, Матчи и Баллы лежат каждый на своей плите, а шапка, герой и карточка игрока — сами
// острова и второй рамки не носят. Плита отделяет «раздел лиги» от «одиночного объекта»: карточка
// турнира внутри плиты читается как одна из многих, та же карточка на бумаге — как единственная.
//
// Один компонент на три блока, а не три копии: радиус, поля и место ссылки «всё» должны совпадать
// у всех трёх, иначе нижний ряд разъезжается по пикселю на каждый блок.
//
// Радиус — токен Кита `--radius-board` (46px): плита и есть «полотно раздела» из его лестницы
// радиусов. В макете стоит 40px — своё число артборда, которому в Ките отвечает именно board.

export function Slab({
  title,
  aside,
  more,
  children,
}: {
  title: ReactNode;
  /** Правый угол шапки: ряд вкладок, разрез, счётчик. */
  aside?: ReactNode;
  /** Ссылка под содержимым: «все турниры», «все матчи», «весь топ». */
  more?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-board bg-surface p-5 font-pouf cushion-card">
      <div className="flex flex-wrap items-center gap-3 px-1.5">
        <h2 className="text-[22px] font-black tracking-[-0.5px] text-ink">{title}</h2>
        {aside && <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">{aside}</div>}
      </div>

      {children}

      {/* Ссылка прижата к низу: в нижнем ряду плиты равной высоты, и «весь топ» у баллов должен
          стоять на одной строке с «все матчи» у соседа, а не всплывать за коротким списком. */}
      {more && (
        <Link
          href={more.href}
          className="mt-auto flex items-center justify-end gap-1.5 px-1.5 pt-1 text-[13px] font-extrabold text-muted transition hover:text-[var(--accent-ink)]"
        >
          {more.label}
          <Icon name="next" size="sm" />
        </Link>
      )}
    </section>
  );
}
