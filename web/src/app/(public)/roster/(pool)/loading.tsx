import { Skeleton, SkeletonHeader, SkeletonList } from "@/components/pouf/skeleton";

// Раздел «Команды»: та же сетка карточек, что и у составов турнира. Полоса между шапкой и сеткой —
// это полоса разрезов и фильтров; без неё содержимое после загрузки прыгало вниз на её высоту.
export default function RosterLoading() {
  return (
    <div className="space-y-6 font-pouf">
      <SkeletonHeader />
      <Skeleton variant="text" className="h-11" />
      <SkeletonList
        count={9}
        variant="card"
        label="Загружаем команды"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 [&>*]:mb-0"
      />
    </div>
  );
}
