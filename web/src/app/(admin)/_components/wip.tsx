import { SITE_MAX_W } from "@/components/pouf/blocks";
import { Badge } from "@/components/pouf/media";
import { EmptyState } from "@/components/pouf/feedback";
import { AdminHeader } from "./admin-header";

// Заглушка раздела в разработке. Место в навигации уже держится (флаг `soon` в _components/tools.ts),
// а самого инструмента ещё нет — показываем честное «в стадии разработки», а не пустую страницу.
//
// Шапка — `AdminHeader`, как на всех служебных экранах после Э9: у заглушки нет причин говорить
// другим голосом, чем у соседей по сайдбару. Сама «нет данных» — китовый `EmptyState` (Э11):
// до него здесь стояла своя подушка с эмодзи-молотком, то есть третий рисунок пустого экрана.
export function WorkInProgress({ title, note }: { title: string; note?: string }) {
  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <AdminHeader title={title} aside={<Badge tone="warn">в разработке</Badge>} />
      <div className="mt-8">
        <EmptyState icon="settings" title="Раздел в стадии разработки">
          {note ?? "Инструмент ещё не готов. Место в навигации зарезервировано — вкладка появится здесь."}
        </EmptyState>
      </div>
    </main>
  );
}
