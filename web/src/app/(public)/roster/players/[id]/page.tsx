import { permanentRedirect } from "next/navigation";
import { getPlayerProfile } from "@/lib/roster-data";
import { playerPath } from "@/lib/profiles";

// Старый адрес карточки. Ссылки на него раздавались в чат, лежат в закладках и в письмах бота,
// поэтому маршрут остаётся — но только чтобы увести на канонический `/players/<slug>`.
// Тот же приём, что у `/standings/*` после переезда таблиц в турниры.
export default async function LegacyPlayerRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = await getPlayerProfile(id);
  permanentRedirect(player ? playerPath(player) : "/roster/players");
}
