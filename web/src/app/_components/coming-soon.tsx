import { SectionHeader, SITE_MAX_W } from "@/components/pouf/blocks";
import { EmptyState } from "@/components/pouf/feedback";
import type { IconName } from "@/components/pouf/Icon";

// Заготовка для страниц, на которые уже ведёт ссылка (футер, разделы), а самой страницы ещё нет.
// Так пункт навигации не бьёт 404 и не притворяется рабочим — честно говорит «скоро».

export function ComingSoon({ title, icon = "clock" }: { title: string; icon?: IconName }) {
  return (
    <main className="flex-1 px-4 py-10 font-pouf md:py-16">
      <div className={`mx-auto w-full ${SITE_MAX_W}`}>
        <SectionHeader eyebrow="Скоро" title={title} />
        <div className="mt-6">
          <EmptyState icon={icon} title="Страница в разработке">
            Раздел ещё не собран — загляните позже.
          </EmptyState>
        </div>
      </div>
    </main>
  );
}
