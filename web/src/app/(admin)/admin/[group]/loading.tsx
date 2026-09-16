import { SITE_MAX_W } from "@/components/pouf/blocks";
import { Skeleton, SkeletonHeader } from "@/components/pouf/skeleton";
import { Grid } from "@/components/pouf/layout";

// Скелет страницы группы: шапка и сетка плиток той же формы, что у готовой страницы —
// шесть плиток по 132 в три колонки. Страница ходит в базу за очередями, поэтому ждать есть чего.

export default function ToolGroupLoading() {
  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 font-pouf md:px-6`}>
      <SkeletonHeader />
      <div role="status" aria-label="Загружаем инструменты" className="mt-8">
        <Grid cols={3}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} variant="card" style={{ opacity: 1 - i * 0.1 }} />
          ))}
        </Grid>
      </div>
    </main>
  );
}
