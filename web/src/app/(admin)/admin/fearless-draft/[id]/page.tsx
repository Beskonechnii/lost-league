import { notFound } from "next/navigation";
import { can } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { listTeamRosters } from "@/lib/roster-data";
import { localHeroes } from "@/lib/dota-constants";
import { heroImg } from "@/lib/assets";
import { teamAccent } from "@/lib/profiles";
import { FEARLESS_VERSION, readableVersion, type FearlessState } from "@/lib/fearless";
import { AdminHeader } from "../../../_components/admin-header";
import { FearlessBoard } from "../_components/fearless-board";
import type { HeroRef, TeamRef } from "../_components/types";

export const dynamic = "force-dynamic";

// Один fearless-драфт: борд с автосейвом. payload — истина состояния; пустой/битый/старой версии
// payload = стартуем с экрана настройки (initialState=null).

export default async function FearlessSessionPage({ params }: { params: Promise<{ id: string }> }) {
  // Право проверяется ЗДЕСЬ, до единого запроса, а не только в layout: Next рендерит сегменты
  // параллельно, и страница успевала сходить в БД раньше, чем гейт layout'а её отменит — весь
  // `initialState` драфта и карточки капитанов (ник, фото, MMR) уезжали во flight-payload экрана
  // отказа. Плашку отказа рисует layout; странице достаточно не отдать данные.
  if (!(await can("tools"))) return null;

  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isInteger(sessionId)) notFound();

  const [session, teams] = await Promise.all([
    prisma.fearlessSession.findUnique({ where: { id: sessionId } }),
    // ради капитана команды: состав нужен за полем isCaptain, а MMR — для его карточки.
    // `operator` — заход из служебной части: показ витрины (ТЗ 32) оператора не касается.
    listTeamRosters(undefined, { operator: true }),
  ]);
  if (!session) notFound();

  let initialState: FearlessState | null = null;
  try {
    const parsed = JSON.parse(session.payload) as FearlessState;
    // Версию нормализуем на чтении: с 42д в состоянии есть необязательное `assigns`,
    // и уже сохранённый драфт прошлой версии — это то же состояние без него.
    if (readableVersion(parsed?.version)) initialState = { ...parsed, version: FEARLESS_VERSION };
  } catch {
    initialState = null; // пустой или битый payload — начинаем с настройки
  }

  const teamRefs: TeamRef[] = teams.map((t) => {
    const cap = t.players.find((p) => p.isCaptain);
    return {
      id: t.id,
      name: t.name,
      color: teamAccent(t),
      logo: t.logo,
      // Капитан не отмечен — обычный случай, флаг проставляется руками в ростер-редакторе.
      captain: cap ? { nickname: cap.nickname, photo: cap.photo, mmr: cap.mmr } : null,
    };
  });
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
