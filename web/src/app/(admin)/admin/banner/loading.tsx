import { FORM_MAX_W } from "@/components/pouf/blocks";
import { Skeleton, SkeletonHeader } from "@/components/pouf/skeleton";

// Скелет экрана правки: шапка и три панели — картинка, текст, показ.

export default function BannerLoading() {
  return (
    <main className={`mx-auto w-full ${FORM_MAX_W} flex-1 px-4 py-8 font-pouf md:px-6`}>
      <SkeletonHeader />
      <div role="status" aria-label="Загружаем баннер" className="mt-6 space-y-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="card" style={{ opacity: 1 - i * 0.15 }} />
        ))}
      </div>
    </main>
  );
}
