import { FORM_MAX_W } from "@/components/pouf/blocks";
import { Skeleton, SkeletonHeader } from "@/components/pouf/skeleton";

// Скелет экрана показа: шапка и одна панель на два тумблера.

export default function PrivacyLoading() {
  return (
    <main className={`mx-auto w-full ${FORM_MAX_W} flex-1 px-4 py-8 font-pouf md:px-6`}>
      <SkeletonHeader />
      <div role="status" aria-label="Загружаем настройки показа" className="mt-6">
        <Skeleton variant="card" />
      </div>
    </main>
  );
}
