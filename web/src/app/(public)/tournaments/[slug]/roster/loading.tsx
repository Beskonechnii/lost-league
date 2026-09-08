import { SkeletonHeader, SkeletonList } from "@/components/pouf/skeleton";

// Составы турнира — сетка карточек в три колонки; скелет повторяет её, а не показывает список строк.
export default function TournamentRosterLoading() {
  return (
    <div className="space-y-6 font-pouf">
      <SkeletonHeader />
      <SkeletonList
        count={9}
        variant="card"
        label="Загружаем составы"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 [&>*]:mb-0"
      />
    </div>
  );
}
