import { Skeleton, SkeletonHeader } from "@/components/pouf/skeleton";
import { FORM_MAX_W } from "@/components/pouf/blocks";

// Скелет страницы записи: шапка, полоса мета-строки и панель действия — форма готового экрана.

export default function JoinLoading() {
  return (
    <div className={`mx-auto w-full ${FORM_MAX_W} space-y-6 px-4 py-10 font-pouf md:py-16`}>
      <SkeletonHeader />
      <div role="status" aria-label="Загружаем турнир" className="space-y-4">
        <Skeleton variant="card" className="h-8" />
        {/* Ряд чипов выбора ролей (ТЗ 38) — 44px, ровно высота чипа, чтобы панель не прыгала. */}
        <Skeleton variant="card" className="h-11" />
        <Skeleton variant="card" className="h-[72px]" />
      </div>
    </div>
  );
}
