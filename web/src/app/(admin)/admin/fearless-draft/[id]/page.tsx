import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listTeams } from "@/lib/roster-data";
import { localHeroes } from "@/lib/dota-constants";
import { heroImg } from "@/lib/assets";
import { teamAccent } from "@/lib/profiles";
import { FEARLESS_VERSION, type FearlessState } from "@/lib/fearless";
import { FearlessBoard, type HeroRef, type TeamRef } from "../_components/fearless-board";
import { denyUnlessPermission } from "../../../_components/permission-gate";
import { SITE_MAX_W } from "@/app/_components/ui";

export const dynamic = "force-dynamic";

// Один fearless-драфт: борд с автосейвом. payload — истина состояния; пустой/битый/старой версии
// payload = стартуем с экрана настройки (initialState=null).

export default async function FearlessSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const denied = await denyUnlessPermission("tools", "Fearless draft");
  if (denied) return denied;

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
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-6 md:px-6`}>
      <Link href="/admin/fearless-draft" className="text-sm text-ink-subtle hover:text-ink-muted">
        ← Все драфты
      </Link>
      <div className="mt-4">
        <FearlessBoard teams={teamRefs} heroes={heroes} sessionId={sessionId} initialState={initialState} />
      </div>
    </main>
  );
}
