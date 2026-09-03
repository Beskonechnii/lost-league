import { notFound } from "next/navigation";
import { playerPath } from "@/lib/profiles";
import { getPlayer, listTeams } from "@/lib/roster-data";
import { roleOrder } from "@/lib/roles";
import { PlayerEditor, SpotsEditor } from "@/app/_components/roster-editors";
import { FORM_MAX_W } from "@/components/pouf/blocks";
import { denyUnlessPermission } from "../../../../../_components/permission-gate";
import { AdminHeader } from "../../../../../_components/admin-header";

export const dynamic = "force-dynamic";

// Правка отделена от профиля: страница игрока читается как карточка, а формы живут здесь.
//
// На Э9 экран получил свою колонку (`<main>` + `FORM_MAX_W`) — раньше он рисовался голым `<div>`
// прямо в оболочке, без ширины и полей. Ссылка «← к профилю» ушла в крошки (UI-GUIDELINES §3).

export default async function PlayerEditPage({ params }: { params: Promise<{ id: string }> }) {
  const denied = await denyUnlessPermission("roster.edit", "Правка игрока");
  if (denied) return denied;

  const { id } = await params;
  const [player, teams] = await Promise.all([getPlayer(Number(id)), listTeams()]);
  if (!player) notFound();

  const spots = [...player.spots].sort((a, b) => roleOrder(a.role) - roleOrder(b.role));

  return (
    <main className={`mx-auto w-full ${FORM_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <AdminHeader
        crumbs={[
          { href: "/roster/players", label: "Игроки" },
          { href: playerPath(player), label: player.nickname },
        ]}
        eyebrow="Правка игрока"
        title={player.nickname}
      />

      <div className="mt-6 space-y-6">
        <PlayerEditor
          id={player.id}
          initial={{
            nickname: player.nickname,
            realName: player.realName ?? "",
            accountId: player.accountId ?? "",
            mmr: player.mmr ? String(player.mmr) : "",
            telegram: player.telegram ?? "",
            // input[type=date] ждёт YYYY-MM-DD; дата лежит полднем UTC, поэтому срез безопасен
            birthday: player.birthday ? player.birthday.toISOString().slice(0, 10) : "",
            city: player.city ?? "",
            country: player.country ?? "",
            photo: player.photo,
            banner: player.banner,
            interviewUrl: player.interviewUrl ?? "",
            orderNo: player.orderNo != null ? String(player.orderNo) : "",
            achievements: player.achievements ?? "",
            tags: player.tags ?? "",
          }}
        />

        <section>
          <h2 className="mb-3 font-pouf text-[13px] font-extrabold uppercase tracking-[1.5px] text-muted">
            Составы
          </h2>
          <SpotsEditor
            playerId={player.id}
            teams={teams.map((t) => ({ id: t.id, name: t.name }))}
            spots={spots.map((s) => ({
              id: s.id,
              teamId: s.teamId,
              teamName: s.team.name,
              role: s.role ?? "",
              isCaptain: s.isCaptain,
            }))}
          />
        </section>
      </div>
    </main>
  );
}
