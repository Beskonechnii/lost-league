import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listTeams } from "@/lib/roster-data";
import { localHeroes } from "@/lib/dota-constants";
import { heroImg } from "@/lib/assets";
import { teamAccent } from "@/lib/profiles";
import { FEARLESS_VERSION, type FearlessState } from "@/lib/fearless";
import { AdminHeader } from "../../../_components/admin-header";
import { FearlessBoard } from "../_components/fearless-board";
import type { HeroRef, TeamRef } from "../_components/types";

export const dynamic = "force-dynamic";

// Один fearless-драфт: борд с автосейвом. payload — истина состояния; пустой/битый/старой версии
// payload = стартуем с экрана настройки (initialState=null).

export default async function FearlessSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isInteger(sessionId)) notFound();

  const [session, teams] = await Promise.all([
    prisma.fearlessSession.findUnique({ where: { id: sessionId } }),
    listTeams(),
  ]);
  if (!session) notFound();

  let initialState: FearlessState | null = null;
  try {
    const parsed = JSON.parse(session.payload) as FearlessState;
    if (parsed?.version === FEARLESS_VERSION) initialState = parsed;
  } catch {
    initialState = null; // пустой или битый payload — начинаем с настройки
  }

  const teamRefs: TeamRef[] = teams.map((t) => ({ id: t.id, name: t.name, color: teamAccent(t), logo: t.logo }));
  const heroes: HeroRef[] = localHeroes()
    .map((h) => {
      const slug = h.name.replace(/^npc_dota_hero_/, "");
      return { id: h.id, name: h.localized_name, slug, img: heroImg(slug), attr: h.primary_attr };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      {/* Крошки, а не «← Все драфты»: где ты находишься, стрелка назад не говорит (§C3). */}
      <AdminHeader
        crumbs={[
          { href: "/admin", label: "Служебная часть" },
          { href: "/admin/fearless-draft", label: "Fearless draft" },
        ]}
        eyebrow="Драфт героев"
        title={session.title || `Драфт #${session.id}`}
      />
      <FearlessBoard
        teams={teamRefs}
        heroes={heroes}
        sessionId={sessionId}
        initialTitle={session.title}
        initialState={initialState}
      />
    </div>
  );
}
