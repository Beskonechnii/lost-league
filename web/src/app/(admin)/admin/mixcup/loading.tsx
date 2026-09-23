import { Skeleton, SkeletonHeader } from "@/components/pouf/skeleton";

// Скелет списка событий — шапка и сетка карточек той же формы, что у SessionList.

export default function MixCupListLoading() {
  return (
    <div className="space-y-8 font-pouf">
      <SkeletonHeader />
      <div role="status" aria-label="Загружаем Mix Cup" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} variant="card" style={{ opacity: 1 - i * 0.1 }} />
        ))}
      </div>
    </div>
  );
}
