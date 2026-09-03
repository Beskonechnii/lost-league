import { SITE_MAX_W } from "@/components/pouf/blocks";

// Страница игрока — сущность лиги сама по себе, поэтому у неё свой корень адреса, а не место
// внутри ростера (решение 04.09.2026 в DECISIONS.md). Колонка та же, что у витрин: край страницы
// совпадает с шапкой и списками, откуда на карточку и приходят.
export default function PlayerPageLayout({ children }: { children: React.ReactNode }) {
  return <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>{children}</main>;
}
