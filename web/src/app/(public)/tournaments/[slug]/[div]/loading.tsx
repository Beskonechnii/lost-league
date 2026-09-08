import { SkeletonHeader, SkeletonList } from "@/components/pouf/skeleton";

// Один скелет на все этапы дивизиона: таблица, группы, плей-офф, статистика. Форма у них общая —
// шапка и ряд строк, — а строка турнира и колонка приходят от layout'а турнира и остаются на месте,
// поэтому навигация во время загрузки не мигает и по ней можно уйти дальше.
export default function DivisionLoading() {
  return (
    <div className="space-y-6 font-pouf">
      <SkeletonHeader />
      <SkeletonList count={8} label="Загружаем таблицу" />
    </div>
  );
}
