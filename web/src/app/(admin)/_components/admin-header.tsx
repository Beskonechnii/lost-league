import type { ReactNode } from "react";
import type { Crumb } from "@/components/pouf/breadcrumbs";
import { SectionHeader } from "@/components/pouf/blocks";
import { AdminCrumbs } from "./admin-crumbs";

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
 *
 * Первую ступень — «Админ» → /admin — шапка подставляет сама (ТЗ 08): после
 * удаления сайдбара хаб стал единственным списком инструментов, и дописывать
 * возврат на него руками в двадцати файлах значит оставить половину без него.
 * С ТЗ 27 тем же порядком подставляется и ступень группы — см. `AdminCrumbs`.
 */

export function AdminHeader({
  crumbs,
  eyebrow = "Служебная часть",
  title,
  aside,
  children,
}: {
  /** Путь без последней ступени, без хаба и без группы: текущую страницу называет H1
   *  (UI-GUIDELINES §3), а «Админ» и группу подставляет `AdminCrumbs`. */
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
      <AdminCrumbs crumbs={crumbs} />
      <SectionHeader eyebrow={eyebrow} title={title} aside={aside} />
      {children && (
        // Мера абзаца — не во всю колонку: пояснение читают строкой, а не сканируют.
        <p className="mt-3 max-w-[70ch] text-sm font-bold leading-[1.55] text-muted">{children}</p>
      )}
    </header>
  );
}
