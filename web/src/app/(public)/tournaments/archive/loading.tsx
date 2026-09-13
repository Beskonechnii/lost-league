import { SITE_MAX_W } from "@/components/pouf/blocks";
import { SkeletonHeader, SkeletonList } from "@/components/pouf/skeleton";

// Лента всех турниров лиги: шапка и строки-подушки — та же форма, что у готовой хронологии.

export default function ArchiveLoading() {
  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <SkeletonHeader />
      <div className="mt-(--s6)">
        <SkeletonList count={8} variant="row" />
      </div>
    </main>
  );
}
