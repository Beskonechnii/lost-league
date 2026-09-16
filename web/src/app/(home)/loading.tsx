import { SITE_MAX_W } from "@/components/pouf/blocks";
import { Skeleton } from "@/components/pouf/skeleton";

// Скелет верхнего ряда витрины. Нужен именно ему: главная `force-dynamic`, и к запросам за
// турнирами и встречами добавился поход за баннером — первый экран не должен прыгать, пока он
// едет. Высоты повторяют герой один в один (полотно 170/300, две строки заголовка, две подписи,
// полоса кнопки), иначе подмена сдвинет раскладку и заберёт всё, ради чего скелет ставят.

export default function HomeLoading() {
  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 space-y-6 px-4 pb-8 pt-4 font-pouf md:px-6`}>
      <div
        role="status"
        aria-label="Загружаем витрину"
        className="flex flex-col-reverse gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_351px] lg:items-stretch"
      >
        <div className="rounded-card bg-surface p-[22px] cushion-card">
          <Skeleton className="h-[170px] w-full rounded-card sm:h-[300px]" />
          <div className="mt-[18px] space-y-2.5 px-2">
            <Skeleton variant="text" className="h-[30px] w-3/4" />
            <Skeleton variant="text" className="h-[18px] w-full" />
            <Skeleton variant="text" className="h-[18px] w-2/3" />
            <Skeleton className="mt-2 h-[48px] w-[262px] max-w-full rounded-pill" />
          </div>
        </div>
        <Skeleton variant="card" className="h-[315px] w-full" />
      </div>
    </main>
  );
}
