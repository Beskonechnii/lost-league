import { SkeletonHeader, SkeletonList } from "@/components/pouf/skeleton";

// Пул команд лиги: та же сетка карточек, что и у составов турнира.
export default function RosterLoading() {
  return (
    <div className="space-y-6 font-pouf">
      <SkeletonHeader />
      <SkeletonList
        count={9}
        variant="card"
        label="Загружаем ростер"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 [&>*]:mb-0"
      />
    </div>
  );
}
