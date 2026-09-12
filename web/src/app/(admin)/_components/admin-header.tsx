import type { ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "@/components/pouf/breadcrumbs";
import { SectionHeader } from "@/components/pouf/blocks";

/* Шапка служебного экрана: крошки → eyebrow → H1 → одна поясняющая фраза.
 *
 * Заводится на Э9, потому что до него эти четыре строки были СКОПИРОВАНЫ на
 * каждом экране админки, и копии разошлись: eyebrow набирали `text-[11px]
 * … text-amber-700` (жёлтая подпись мимо токенов Кита и мимо `Eyebrow`), H1 —
 * руками `text-xl font-bold` вместо `SectionHeader` (тот самый антипаттерн
 * «H1 собран классами», UI-GUIDELINES §9), а вместо крошек наверху страницы
 * стояла ссылка «← Все турниры» — способ ориентации, который стандарт
 * запрещает (§3): он не говорит, где ты, и дублирует кнопку браузера.
 *
 * Крошки передаёт сам экран, а не выводит из адреса: у служебных страниц путь
 * не совпадает с URL (заявки команд лежат внутри турнира, а называются его
 * именем), и вывод по сегментам дал бы слаг вместо названия.
 */

export function AdminHeader({
  crumbs,
  eyebrow = "Служебная часть",
  title,
  aside,
  children,
}: {
  /** Путь без последней ступени: текущую страницу называет H1 (UI-GUIDELINES §3). */
  crumbs?: Crumb[];
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Действие или счётчик справа от заголовка. */
  aside?: ReactNode;
  /** Одна фраза о том, что это за экран и что здесь делают. */
  children?: ReactNode;
}) {
  return (
    <header className="font-pouf">
      {crumbs && crumbs.length > 0 && <Breadcrumbs items={crumbs} className="mb-3" />}
      <SectionHeader eyebrow={eyebrow} title={title} aside={aside} />
      {children && (
        // Мера абзаца — не во всю колонку: пояснение читают строкой, а не сканируют.
        <p className="mt-3 max-w-[70ch] text-sm font-bold leading-[1.55] text-muted">{children}</p>
      )}
    </header>
  );
}
