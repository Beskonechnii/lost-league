import { permanentRedirect } from "next/navigation";
import { getPlayerProfile } from "@/lib/roster-data";
import { playerPath } from "@/lib/profiles";

// Старый адрес карточки. Ссылки на него раздавались в чат, лежат в закладках и в письмах бота,
// поэтому маршрут остаётся — но только чтобы увести на канонический `/players/<slug>`.
// Тот же приём, что у `/standings/*` после переезда таблиц в турниры.
//
// Список игроков лежит в группе `(list)` не ради порядка в папках: его `loading.tsx` накрыл бы
// Suspense'ом и этот маршрут, а под открытым Suspense редирект заголовком уже не отдать — ответ
// ушёл потоком, и вместо 308 краулер получал 200 с пустой оболочкой (soft-404). Ровно поэтому же
// в `(pool)` вынесен список команд.
export default async function LegacyPlayerRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = await getPlayerProfile(id);
  permanentRedirect(player ? playerPath(player) : "/roster/players");
}
