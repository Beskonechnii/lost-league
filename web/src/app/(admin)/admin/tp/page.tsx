import { listPlayers } from "@/lib/roster-data";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { TpAdmin } from "./_components/tp-admin";
import { denyUnlessPermission } from "../../_components/permission-gate";
import { currentTournament } from "@/lib/tournaments";
import { tpByTournament } from "@/lib/tp";

export const dynamic = "force-dynamic";

export const metadata = { title: "TP" };

// Служебная часть: проставить игрокам TP (очки MVP) за текущий турнир. Оператор правит их вручную
// раз в неделю. Пишет через PATCH /api/roster/players/[id] — тот же путь, что и правка анкеты; сам
// PATCH кладёт разницу строкой в реестр начислений (src/lib/tp.ts), а не переписывает поле.
//
// В поле показываем итог **за турнир**, а не за всё время: иначе оператор, поправив цифру, случайно
// перенёс бы в текущий сезон всё накопленное игроком.
export default async function TpAdminPage() {
  const denied = await denyUnlessPermission("tp.edit", "TP");
  if (denied) return denied;

  const [players, current] = await Promise.all([listPlayers(), currentTournament()]);
  const season = await tpByTournament(current?.id ?? null);

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <TpAdmin
        title={current ? `TP · ${current.short ?? current.name}` : "TP"}
        players={players.map((p) => ({ id: p.id, nickname: p.nickname, tp: season.get(p.id) ?? 0 }))}
      />
    </main>
  );
}
