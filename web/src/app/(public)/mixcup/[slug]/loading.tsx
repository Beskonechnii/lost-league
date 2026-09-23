import { Skeleton, SkeletonHeader } from "@/components/pouf/skeleton";
import { FORM_MAX_W } from "@/components/pouf/blocks";

// Скелет страницы события: шапка, полоса мета-строки и панель действия — форма готового экрана.

export default function MixCupEventLoading() {
  return (
    <div className={`mx-auto w-full ${FORM_MAX_W} space-y-6 px-4 py-10 font-pouf md:py-16`}>
      <SkeletonHeader />
      <div role="status" aria-label="Загружаем событие" className="space-y-4">
        <Skeleton variant="card" className="h-8" />
        <Skeleton variant="card" className="h-[72px]" />
      </div>
    </div>
  );
}
