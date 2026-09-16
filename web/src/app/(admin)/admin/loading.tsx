import { SITE_MAX_W } from "@/components/pouf/blocks";
import { Skeleton, SkeletonHeader } from "@/components/pouf/skeleton";
import { Grid } from "@/components/pouf/layout";

// Скелет хаба. Нужен именно ему: после удаления сайдбара это единственный вход в инструменты,
// открывают его с каждой служебной страницы, а он ходит в базу за очередями.
//
// Форма повторяет `HubGroupCards`: четыре карточки групп в две колонки по 190px. Число и сетка
// те же, что у готового экрана, иначе при каждом открытии хаб прыгает.

export default function AdminHubLoading() {
  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 font-pouf md:px-6`}>
      <SkeletonHeader />
      <div role="status" aria-label="Загружаем инструменты" className="mt-8">
        <Grid cols={2}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} variant="card" h={190} style={{ opacity: 1 - i * 0.1 }} />
          ))}
        </Grid>
      </div>
    </main>
  );
}
