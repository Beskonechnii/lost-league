import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bad, parseId } from "@/lib/api";
import { guard } from "@/lib/api-guard";
import { isTournamentStatus } from "@/lib/tournaments";
import type { DraftState } from "@/lib/draft";

// Турнир индивидуального формата: название, статус, тумблеры правил драфта.
//
// Тумблеры «Украсть»/«Закрепить» — свойство турнира (значения по умолчанию для нового драфта),
// но пока живая сессия ещё не дошла до фазы draft, правки синхронно уезжают и в её DraftState —
// иначе переключатель на экране турнира ничего бы не менял в уже открытом борде (§DEV ТЗ 33).

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard("tournaments.edit");
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");
  const body = (await req.json()) as {
    name?: string;
    status?: string;
    stealEnabled?: boolean;
    lockEnabled?: boolean;
  };

  if (body.status !== undefined && !isTournamentStatus(body.status)) return bad("Неизвестный статус турнира");

  const tournament = await prisma.tournament.findUnique({ where: { id }, include: { draftSettings: true } });
  if (!tournament) return bad("Турнир не найден", 404);
  if (tournament.kind === "season") return bad("У сезонного турнира нет правил драфта", 400);

  const data: { name?: string; status?: string } = {};
  if (body.name !== undefined && body.name.trim()) data.name = body.name.trim();
  if (body.status !== undefined) data.status = body.status;
  if (Object.keys(data).length > 0) await prisma.tournament.update({ where: { id }, data });

  const rules: { stealEnabled?: boolean; lockEnabled?: boolean } = {};
  if (body.stealEnabled !== undefined) rules.stealEnabled = body.stealEnabled;
  if (body.lockEnabled !== undefined) rules.lockEnabled = body.lockEnabled;
  const settings =
    Object.keys(rules).length > 0
      ? await prisma.tournamentDraftSettings.upsert({
          where: { tournamentId: id },
          create: { tournamentId: id, ...rules },
          update: rules,
        })
      : tournament.draftSettings;

  // Правило ещё можно поменять на ходу только пока сессия не начала сам драфт (roster/config) —
  // на draft/done тумблер на экране турнира и так недоступен (disabled), это лишь защита сервера.
  if (settings && Object.keys(rules).length > 0 && settings.draftSessionId) {
    const session = await prisma.draftSession.findUnique({ where: { id: settings.draftSessionId } });
    if (session) {
      try {
        const state = JSON.parse(session.payload) as DraftState;
        if (state.phase === "roster" || state.phase === "config") {
          const next: DraftState = {
            ...state,
            stealEnabled: settings.stealEnabled,
            lockEnabled: settings.lockEnabled,
          };
          await prisma.draftSession.update({ where: { id: session.id }, data: { payload: JSON.stringify(next) } });
        }
      } catch {
        // битый payload — не наша забота здесь, борд сам откатится на пустой конфиг
      }
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard("tournaments.edit");
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");
  const tournament = await prisma.tournament.findUnique({ where: { id }, include: { draftSettings: true } });
  if (!tournament) return bad("Турнир не найден", 404);
  if (tournament.kind === "season") return bad("Сезонный турнир удаляется со своей карточки", 400);
  // Команды/пики/настройки сносятся каскадом; живую сессию (если есть) убираем отдельно — SetNull
  // её не тронет.
  const sessionId = tournament.draftSettings?.draftSessionId ?? null;
  await prisma.tournament.delete({ where: { id } });
  if (sessionId) await prisma.draftSession.deleteMany({ where: { id: sessionId } });
  return NextResponse.json({ ok: true });
}
