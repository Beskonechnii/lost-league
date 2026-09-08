import { Skeleton, SkeletonList } from "@/components/pouf/skeleton";

// Карточка игрока: шапка с фото и именем, под ней блоки статистики. Считается дольше витрин —
// карьерка собирается по всем сериям игрока, — поэтому скелет здесь нужнее всего.
export default function PlayerLoading() {
  return (
    <div className="space-y-6 font-pouf">
      <Skeleton variant="card" className="h-[168px]" />
      <SkeletonList count={4} label="Загружаем профиль игрока" />
    </div>
  );
}
