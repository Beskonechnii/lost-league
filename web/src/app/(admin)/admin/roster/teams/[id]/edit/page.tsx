import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeam } from "@/lib/roster-data";
import { TeamEditor } from "@/app/_components/roster-editors";
import { denyUnlessPermission } from "../../../../../_components/permission-gate";

export const dynamic = "force-dynamic";

// Как и у игрока: страница команды — витрина, формы живут отдельно.
export default async function TeamEditPage({ params }: { params: Promise<{ id: string }> }) {
  const denied = await denyUnlessPermission("roster.edit", "Правка команды");
  if (denied) return denied;

  const { id } = await params;
  const team = await getTeam(Number(id));
  if (!team) notFound();

  return (
    <div className="space-y-6 font-pouf">
      <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-muted">
        <Link href="/roster/teams" className="hover:text-[var(--accent-ink)]">
          Команды
        </Link>
        <span className="text-ink-subtle">/</span>
        <Link href={`/roster/teams/${team.id}`} className="hover:text-[var(--accent-ink)]">
          {team.name}
        </Link>
        <span className="text-ink-subtle">/</span>
        <span className="text-ink-muted">правка</span>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-black tracking-[-0.5px] text-ink md:text-4xl">{team.name}</h1>
          <p className="text-xs font-bold text-muted">slug: {team.slug} — ключ импорта составов и подбора файлов</p>
        </div>
        <Link href={`/roster/teams/${team.id}`} className="text-sm font-bold text-muted hover:text-[var(--accent-ink)]">
          ← к команде
        </Link>
      </div>

      <TeamEditor
        id={team.id}
        initial={{
          name: team.name,
          tag: team.tag ?? "",
          group: team.group ?? "",
          color: team.color ?? "",
          logo: team.logo,
          wordmark: team.wordmark,
          photo: team.photo,
          banner: team.banner,
        }}
      />

      <p className="text-sm font-bold text-muted">
        Состав правится на карточках игроков: роль и капитанство принадлежат месту в составе.
      </p>
    </div>
  );
}
