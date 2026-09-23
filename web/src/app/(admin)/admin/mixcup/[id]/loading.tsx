import { Skeleton, SkeletonHeader } from "@/components/pouf/skeleton";

// Скелет экрана события: шапка и панель «Правила» той же высоты, что у готового экрана.

export default function MixCupEventLoading() {
  return (
    <div className="space-y-6 font-pouf">
      <SkeletonHeader />
      <div role="status" aria-label="Загружаем событие">
        <Skeleton variant="card" className="h-[168px]" />
      </div>
    </div>
  );
}
