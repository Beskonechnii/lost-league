import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayer, listTeams } from "@/lib/roster-data";
import { roleOrder } from "@/lib/roles";
import { PlayerEditor, SpotsEditor } from "@/app/_components/roster-editors";
import { denyUnlessPermission } from "../../../../../_components/permission-gate";

export const dynamic = "force-dynamic";

// Правка отделена от профиля: страница игрока читается как карточка, а формы живут здесь.
export default async function PlayerEditPage({ params }: { params: Promise<{ id: string }> }) {
  const denied = await denyUnlessPermission("roster.edit", "Правка игрока");
  if (denied) return denied;

  const { id } = await params;
  const [player, teams] = await Promise.all([getPlayer(Number(id)), listTeams()]);
  if (!player) notFound();

  const spots = [...player.spots].sort((a, b) => roleOrder(a.role) - roleOrder(b.role));

  return (
    <div className="space-y-6 font-pouf">
      <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-muted">
        <Link href="/roster/players" className="hover:text-[var(--accent-ink)]">
          Игроки
        </Link>
        <span className="text-ink-subtle">/</span>
        <Link href={`/roster/players/${player.id}`} className="hover:text-[var(--accent-ink)]">
          {player.nickname}
        </Link>
        <span className="text-ink-subtle">/</span>
        <span className="text-ink-muted">правка</span>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[28px] font-black tracking-[-0.5px] text-ink md:text-4xl">{player.nickname}</h1>
        <Link href={`/roster/players/${player.id}`} className="text-sm font-bold text-muted hover:text-[var(--accent-ink)]">
          ← к профилю
        </Link>
      </div>

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
        <h2 className="mb-3 text-[13px] font-extrabold uppercase tracking-[1.5px] text-muted">Составы</h2>
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
  );
}
