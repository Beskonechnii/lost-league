import { Skeleton, SkeletonHeader } from "@/components/pouf/skeleton";

/**
 * Скелет комнаты (ТЗ 42г, DESIGN-9). Рисует ФОРМУ борда — две колонки слотов и сетку пула, —
 * а не «идёт загрузка»: страница комнаты ходит в базу за составом, чатом и часами, и пустой
 * экран на эту паузу читается как «комнату закрыли».
 *
 * Слоты и плитки в тех же пропорциях 16/9 и в той же сетке (`pouf-draft`), что настоящий борд:
 * иначе экран прыгает в момент, когда данные приехали.
 */
export default function LobbyLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Комната загружается">
      <SkeletonHeader />
      <section className="pouf-draft">
        {(["a", "b"] as const).map((rail) => (
          <div key={rail} className={`pouf-draft__rail-${rail}`}>
            <div className="pouf-rail">
              <Skeleton variant="text" className="h-[15px] w-32" />
              <div className="pouf-rail__bans">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="aspect-[16/9] h-auto w-full" />
                ))}
              </div>
              <div className="pouf-rail__picks">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="aspect-[16/9] h-auto w-full" />
                ))}
              </div>
            </div>
          </div>
        ))}
        <div className="pouf-draft__center">
          <div className="pouf-pool">
            {Array.from({ length: 36 }, (_, i) => (
              <Skeleton key={i} className="aspect-[16/9] h-auto w-full" />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
