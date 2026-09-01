import { SITE_MAX_W } from "@/components/pouf/blocks";

// Карточки ростера — команда и игрок — живут вне турнира: они сущности лиги, а не сезона
// (списки переехали в /tournaments/<slug>/roster). Своей обёртки у них не было: страница
// рендерилась прямо в body и оказывалась шире всех остальных витрин — шапка кончалась в одном
// месте, содержимое карточки в другом. Колонка здесь та же `SITE_MAX_W`, что и у списков,
// поэтому край страницы совпадает с шапкой и подменю. Путь наверх дают крошки самой карточки —
// они знают турнир и команду, чего кнопка «Назад» не знала.
export default function RosterCardLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      {children}
    </main>
  );
}
