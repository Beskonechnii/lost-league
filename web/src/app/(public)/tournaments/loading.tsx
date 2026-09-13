import { SITE_MAX_W } from "@/components/pouf/blocks";
import { Skeleton, SkeletonHeader } from "@/components/pouf/skeleton";

// Раздел ходит в базу за всеми турнирами, их дивизионами и участием — до ТЗ 09 ожидание было
// пустым экраном. Скелет рисует форму будущего раздела: шапка, лицо во всю ширину, сетка групп.

export default function TournamentsLoading() {
  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <SkeletonHeader />
      <div className="mt-(--s6)">
        <Skeleton variant="card" className="h-[260px]" />
      </div>
      <div className="mt-(--s6) grid gap-5 min-[900px]:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} variant="card" className="h-[220px]" />
        ))}
      </div>
    </main>
  );
}
