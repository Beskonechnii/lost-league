import { SITE_MAX_W } from "@/components/pouf/blocks";
import { Skeleton, SkeletonHeader } from "@/components/pouf/skeleton";

// Скелет хаба. Нужен именно ему: после удаления сайдбара это единственный список инструментов,
// и открывают его с каждой служебной страницы, а он ходит в базу за очередью модерации.
// Форма повторяет `HubGroupedTiles` — шапка и сетка плиток той же ширины.

export default function AdminHubLoading() {
  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 font-pouf md:px-6`}>
      <SkeletonHeader />
      <div role="status" aria-label="Загружаем инструменты" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} variant="card" style={{ opacity: 1 - i * 0.1 }} />
        ))}
      </div>
    </main>
  );
}
