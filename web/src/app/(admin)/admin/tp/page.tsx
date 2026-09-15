import { listPlayers } from "@/lib/roster-data";
import { prisma } from "@/lib/prisma";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { PillLink } from "@/components/pouf/tabs";
import { TpAdmin } from "./_components/tp-admin";
import { TeamTpAdmin } from "./_components/team-tp-admin";
import { AdminHeader } from "../../_components/admin-header";
import { denyUnlessPermission } from "../../_components/permission-gate";
import { currentTournament } from "@/lib/tournaments";
import { tpByTournament } from "@/lib/tp";
import { teamRating, teamTpLedger } from "@/lib/team-rating";

export const dynamic = "force-dynamic";

export const metadata = { title: "TP" };

// Служебная часть: зачёт TP за текущий турнир — две вкладки, игроки и команды.
//
// Игроки: оператор правит ИТОГ за турнир, PATCH /api/roster/players/[id] кладёт разницу строкой
// в реестр начислений (src/lib/tp.ts). В поле показываем итог **за турнир**, а не за всё время:
// иначе оператор, поправив цифру, случайно перенёс бы в текущий сезон всё накопленное игроком.
//
// Команды (ТЗ 13): вводится СУММА начисления, а не итог, — команде начисляют разово за место и за
// заслуги, а итог это сумма строк. Отмена — обратной строкой, чтобы «за что» не стиралось.
export default async function TpAdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const denied = await denyUnlessPermission("tp.edit", "TP");
  if (denied) return denied;

  const teamsTab = (await searchParams).tab === "teams";
  const current = await currentTournament();

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      {/* Шапка — на странице, а не в редакторе: путь до раздела рисует `AdminHeader`, и он же
          ставит первой крошкой возврат на хаб. */}
      <AdminHeader
        eyebrow="Служебная часть · зачёт"
        title={current ? `TP · ${current.short ?? current.name}` : "TP"}
      />

      {/* Разрез живёт в адресе: ссылку на нужную вкладку можно кинуть в чат. */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <PillLink href="/admin/tp" active={!teamsTab} size="md">
          Игроки
        </PillLink>
        <PillLink href="/admin/tp?tab=teams" active={teamsTab} size="md">
          Команды
        </PillLink>
      </div>

      {teamsTab ? <TeamsPanel tournamentId={current?.id ?? null} /> : <PlayersPanel tournamentId={current?.id ?? null} />}
    </main>
  );
}

async function PlayersPanel({ tournamentId }: { tournamentId: number | null }) {
  const [players, season] = await Promise.all([listPlayers(), tpByTournament(tournamentId)]);
  return <TpAdmin players={players.map((p) => ({ id: p.id, nickname: p.nickname, tp: season.get(p.id) ?? 0 }))} />;
}

async function TeamsPanel({ tournamentId }: { tournamentId: number | null }) {
  // Команды берём прямо из таблицы, а не через listPoolTeams: здесь нужны имя и id, тянуть ради
  // выпадающего списка составы всей лиги незачем. Архивные в начисление не предлагаем.
  const [teams, rating, ledger] = await Promise.all([
    prisma.team.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    teamRating(tournamentId),
    teamTpLedger(tournamentId),
  ]);

  return (
    <TeamTpAdmin
      teams={teams.map((t) => ({
        id: t.id,
        name: t.name,
        score: rating.get(t.id)?.score ?? null,
        place: rating.get(t.id)?.place ?? null,
      }))}
      ledger={ledger.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
    />
  );
}
