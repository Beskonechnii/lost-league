import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bad, parseId } from "@/lib/api";
import { guard } from "@/lib/api-guard";
import { isMixCupStatus } from "@/lib/mixcup";
import type { DraftState } from "@/lib/draft";

// Одно событие Mix Cup: название, статус, тумблеры правил.
//
// Тумблеры «Украсть»/«Закрепить» — свойство события (значения по умолчанию для нового драфта),
// но пока живая сессия ещё не дошла до фазы draft, правки синхронно уезжают и в её DraftState —
// иначе переключатель на экране события ничего бы не менял в уже открытом борде (§DEV ТЗ 33).

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard("mixcup");
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");
  const body = (await req.json()) as {
    title?: string;
    status?: string;
    stealEnabled?: boolean;
    lockEnabled?: boolean;
  };

  if (body.status !== undefined && !isMixCupStatus(body.status)) return bad("Неизвестный статус события");

  const data: { title?: string | null; status?: string; stealEnabled?: boolean; lockEnabled?: boolean } = {};
  if (body.title !== undefined) data.title = body.title.trim() || null;
  if (body.status !== undefined) data.status = body.status;
  if (body.stealEnabled !== undefined) data.stealEnabled = body.stealEnabled;
  if (body.lockEnabled !== undefined) data.lockEnabled = body.lockEnabled;

  const event = await prisma.mixCupEvent.findUnique({ where: { id } });
  if (!event) return bad("Событие не найдено", 404);
  const updated = await prisma.mixCupEvent.update({ where: { id }, data });

  // Правило ещё можно поменять на ходу только пока сессия не начала сам драфт (roster/config) —
  // на draft/done тумблер на экране события и так недоступен (disabled), это лишь защита сервера.
  if ((body.stealEnabled !== undefined || body.lockEnabled !== undefined) && event.draftSessionId) {
    const session = await prisma.draftSession.findUnique({ where: { id: event.draftSessionId } });
    if (session) {
      try {
        const state = JSON.parse(session.payload) as DraftState;
        if (state.phase === "roster" || state.phase === "config") {
          const next: DraftState = {
            ...state,
            stealEnabled: updated.stealEnabled,
            lockEnabled: updated.lockEnabled,
          };
          await prisma.draftSession.update({ where: { id: session.id }, data: { payload: JSON.stringify(next) } });
        }
      } catch {
        // битый payload — не наша забота здесь, борд сам откатится на пустой конфиг
      }
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard("mixcup");
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");
  const event = await prisma.mixCupEvent.findUnique({ where: { id } });
  if (!event) return bad("Событие не найдено", 404);
  // Команды/пики сносятся каскадом; живую сессию (если есть) убираем отдельно — SetNull её не тронет.
  await prisma.mixCupEvent.delete({ where: { id } });
  if (event.draftSessionId) await prisma.draftSession.deleteMany({ where: { id: event.draftSessionId } });
  return NextResponse.json({ ok: true });
}
