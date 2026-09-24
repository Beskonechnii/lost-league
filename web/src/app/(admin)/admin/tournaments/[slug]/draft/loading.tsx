import { Skeleton, SkeletonHeader } from "@/components/pouf/skeleton";
import { SITE_MAX_W } from "@/components/pouf/blocks";

// Скелет борда: шапка, полоса тулбара, сетка команд и полоса пула — форма готового экрана.

export default function TournamentDraftLoading() {
  return (
    <div className={`mx-auto w-full ${SITE_MAX_W} flex-1 space-y-6 px-4 py-8 font-pouf md:px-6`}>
      <SkeletonHeader />
      <div role="status" aria-label="Загружаем драфт" className="space-y-4">
        <Skeleton variant="card" className="h-[56px]" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} variant="card" className="h-[260px]" style={{ opacity: 1 - i * 0.1 }} />
          ))}
        </div>
        <Skeleton variant="card" className="h-[320px]" />
      </div>
    </div>
  );
}
