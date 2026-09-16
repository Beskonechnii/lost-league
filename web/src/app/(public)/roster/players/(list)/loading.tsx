import { Skeleton, SkeletonHeader, SkeletonList } from "@/components/pouf/skeleton";

// Свой скелет, а не соседский из /roster: один loading.tsx на два раздела — это снова одно имя
// над двумя экранами, и читалка объявляла бы «Загружаем команды» на витрине игроков.
export default function RosterPlayersLoading() {
  return (
    <div className="space-y-6 font-pouf">
      <SkeletonHeader />
      <Skeleton variant="text" className="h-11" />
      <SkeletonList
        count={12}
        variant="card"
        label="Загружаем игроков"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 [&>*]:mb-0"
      />
    </div>
  );
}
