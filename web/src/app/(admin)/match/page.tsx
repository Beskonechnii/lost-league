import type { Metadata } from "next";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { ArchiveShelf } from "./_components/archive-shelf";
import { MatchForm } from "./_components/match-form";
import { denyUnlessPermission } from "../_components/permission-gate";

// Входная дверь постгейма: ввод id матча. Сам отчёт — на /match/<id>, у него постоянная ссылка.
// Сервис публичный (решено с заказчиком): разбираем любой матч Dota 2, не только матчи лиги.

export const metadata: Metadata = {
  title: "Разбор матча",
  description: "Постгейм-отчёт по матчу Dota 2: скорборд, драфт, таланты, предметы и график преимущества.",
};

export default async function MatchPage() {
  // Разбор матча — операторский инструмент чтения (право tools), а не публичный сервис.
  const denied = await denyUnlessPermission("tools", "Разбор матча");
  if (denied) return denied;

  return (
    <main className="flex-1 px-4 py-8 md:px-6">
      <div className={`mx-auto w-full ${SITE_MAX_W} font-pouf`}>
        <h1 className="text-[28px] font-black tracking-[-0.5px] text-ink md:text-4xl">Разбор матча Dota 2</h1>
        <p className="mt-1 max-w-2xl text-sm font-bold text-muted">
          Вставь ID матча — соберём постгейм-отчёт: счёт, драфт, скорборд, таланты, предметы и график
          преимущества. Данные из OpenDota, а если она лежит — из Steam. У отчёта постоянная ссылка,
          ей можно поделиться.
        </p>

        <div className="mt-6">
          <MatchForm />
        </div>

        {/* Полка выгруженных PNG — черновики оператора. Право на страницу и на полку одно (tools),
            поэтому отдельной проверки здесь уже нет. */}
        <div className="mt-8">
          <ArchiveShelf />
        </div>
      </div>
    </main>
  );
}
