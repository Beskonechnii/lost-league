import { Skeleton, SkeletonHeader } from "@/components/pouf/skeleton";

// Скелет борда. Нужен именно здесь: страница `force-dynamic` и ходит за составами всех команд
// лиги (`listTeamRosters` — ради капитана), то есть открывается ощутимо дольше списка. Белый
// экран посреди эфира читается как упавший драфт, а не как «сейчас загрузится».
//
// Форма повторяет борд: шапка, панель «Карта», три колонки (боковые выше центральной).

export default function FearlessSessionLoading() {
  return (
    <div className="space-y-6 font-pouf">
      <SkeletonHeader />
      <div role="status" aria-label="Загружаем драфт" className="space-y-4">
        <Skeleton variant="card" className="h-[118px]" />
        <div className="grid items-start gap-4 xl:grid-cols-[16rem_minmax(0,1fr)_16rem]">
          <Skeleton variant="card" className="h-[420px] max-xl:order-2" />
          <Skeleton variant="card" className="h-[400px] max-xl:order-1 xl:order-2" />
          <Skeleton variant="card" className="h-[420px] order-3" />
        </div>
      </div>
    </div>
  );
}
