import { SITE_MAX_W, SectionHeader } from "@/components/pouf/blocks";
import { Badge } from "@/components/pouf/media";

// Заглушка раздела в разработке. Место в навигации уже держится (флаг `soon` в _components/tools.ts),
// а самого инструмента ещё нет — показываем честное «в стадии разработки», а не пустую страницу.
export function WorkInProgress({ title, note }: { title: string; note?: string }) {
  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 font-pouf md:px-6`}>
      <SectionHeader
        eyebrow="Админка"
        title={title}
        aside={<Badge tone="warn">в разработке</Badge>}
      />
      <div className="mt-8 rounded-card bg-surface px-6 py-16 text-center cushion-card">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-blob bg-accent-fill text-2xl text-[var(--on-accent)] cushion-blob">🛠️</div>
        <p className="mt-4 text-lg font-black text-ink">Раздел в стадии разработки</p>
        <p className="mx-auto mt-2 max-w-md text-sm font-bold text-muted">
          {note ?? "Инструмент ещё не готов. Место в навигации зарезервировано — вкладка появится здесь."}
        </p>
      </div>
    </main>
  );
}
