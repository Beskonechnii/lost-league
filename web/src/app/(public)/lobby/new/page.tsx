import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listTeamRosters } from "@/lib/roster-data";
import { teamAccent } from "@/lib/profiles";
import { canCreateLobby } from "@/lib/lobby";
import { DEFAULT_MAIN_SEC, DEFAULT_RESERVE_SEC } from "@/lib/fearless";
import { SectionHeader } from "@/components/pouf/blocks";
import { NewLobbyForm, type LobbyTeam } from "../_components/new-lobby-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Собрать лобби" };

// Экран сбора комнаты. Заводить лобби может админ (право `tools`) ИЛИ игрок лиги — форма одна на
// обоих (решение 1). Кто не может — 404: раздел закрытый, о его существовании сообщать нечего.

export default async function NewLobbyPage() {
  if (!(await canCreateLobby())) notFound();

  const [rosters, series, accounts] = await Promise.all([
    listTeamRosters(),
    // Привязка к встрече необязательна (решение 13) — поле можно оставить пустым.
    prisma.series.findMany({
      orderBy: { id: "desc" },
      take: 50,
      select: { id: true, division: true, home: { select: { name: true } }, away: { select: { name: true } } },
    }),
    // Позвать можно только того, кому есть куда прислать приглашение и чем войти (решение 12).
    prisma.userAccount.findMany({
      where: { status: "active", playerId: { not: null } },
      select: { playerId: true, player: { select: { nickname: true } } },
    }),
  ]);
  const registered = new Set(accounts.map((a) => a.playerId!));

  // Кого можно позвать ВНЕ составов двух команд — ОБС и вторым админом комнаты (ТЗ 22в §3).
  // Это все игроки лиги с аккаунтом: комментатор в составе не стоит, и брать его из ростера
  // сторон неоткуда.
  const people = accounts
    .map((a) => ({ id: a.playerId!, nickname: a.player?.nickname ?? `#${a.playerId}` }))
    .sort((x, y) => x.nickname.localeCompare(y.nickname));

  const teams: LobbyTeam[] = rosters.map((t) => ({
    id: t.id,
    name: t.name,
    color: teamAccent(t),
    // Только основа и запас: в приглашённые попадают люди, а роль в комнате выбирается рядом.
    players: t.players.map((p) => ({ id: p.id, nickname: p.nickname, role: p.role, invitable: registered.has(p.id) })),
  }));

  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader eyebrow="Лига · комната встречи" title="Собрать лобби" />
      <NewLobbyForm
        teams={teams}
        people={people}
        series={series.map((s) => ({ id: s.id, label: `${s.home.name} — ${s.away.name} · ${s.division}` }))}
        defaults={{ mainSec: DEFAULT_MAIN_SEC, reserveSec: DEFAULT_RESERVE_SEC }}
      />
    </div>
  );
}
