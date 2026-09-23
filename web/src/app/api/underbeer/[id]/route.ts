import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bad, parseId } from "@/lib/api";
import { DRAFT_VERSION, type DraftState } from "@/lib/draft";
import { guard } from "@/lib/api-guard";
import { mmrShown, withoutMmr } from "@/lib/privacy";
import { persistMixCupResult } from "@/lib/mixcup";

// Одна сессия драфта: чтение, автосейв состояния (payload) по каждому ходу, удаление.
// Правила хода живут в src/lib/draft.ts и применяются на клиенте — сюда прилетает уже готовое
// состояние. Сервер лишь проверяет версию формата и что это валидный JSON, а не источник истины
// правил: борд эфемерный, гонок между операторами тут нет (один оператор на эфире).
//
// Один движок, два входа (ТЗ 33): этот роут ведёт и UNDERBEER, и живой борд Mix Cup — вторые
// используют ту же DraftSession, отличает их только связь на MixCupEvent. Право поэтому гейтится
// по этой связи, а не жёстко «underbeer»: у оператора Mix Cup может не быть права на UNDERBEER.

/** «underbeer» для обычной сессии, «mixcup» — если она рабочий стол события Mix Cup. */
async function guardSession(id: number) {
  const session = await prisma.draftSession.findUnique({ where: { id }, select: { mixCupEvent: { select: { id: true } } } });
  return guard(session?.mixCupEvent ? "mixcup" : "underbeer");
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");
  const session = await prisma.draftSession.findUnique({ where: { id } });
  if (!session) return bad("Сессия не найдена", 404);
  // Гейта у роута нет намеренно (OBS ходит без куки), поэтому флаг лиги обязан действовать на
  // ОТВЕТ, а не только на рендер оверлея: иначе закрытое число уезжает первым же curl'ом.
  if (await mmrShown()) return NextResponse.json(session);
  let payload = session.payload;
  try {
    payload = JSON.stringify(withoutMmr(JSON.parse(session.payload)));
  } catch {
    // Битый JSON отдаём как есть: он и так ничего не значит для оверлея.
  }
  return NextResponse.json({ ...session, payload });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");
  const denied = await guardSession(id);
  if (denied) return denied;
  const body = (await req.json()) as { payload?: DraftState; title?: string; status?: string };

  const data: { payload?: string; title?: string | null; status?: string } = {};
  if (body.payload !== undefined) {
    if (body.payload?.version !== DRAFT_VERSION) {
      return bad("Несовместимая версия состояния драфта");
    }
    data.payload = JSON.stringify(body.payload);
    data.status = body.payload.phase === "done" ? "done" : "draft";
  }
  if (body.title !== undefined) data.title = body.title.trim() || null;
  if (body.status !== undefined) data.status = body.status;

  const { count } = await prisma.draftSession.updateMany({ where: { id }, data });
  if (!count) return bad("Сессия не найдена", 404);

  // Mix Cup: результат не только payload — как только драфт доходит до done, строки уезжают
  // в durable-таблицы (MixCupTeam/MixCupPick), UNDERBEER этот шаг не делает (см. lib/mixcup.ts).
  if (body.payload?.phase === "done") {
    const withEvent = await prisma.draftSession.findUnique({ where: { id }, include: { mixCupEvent: true } });
    if (withEvent?.mixCupEvent) await persistMixCupResult(withEvent.mixCupEvent.id, body.payload);
  }

  return NextResponse.json(await prisma.draftSession.findUnique({ where: { id } }));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");
  const denied = await guardSession(id);
  if (denied) return denied;
  const { count } = await prisma.draftSession.deleteMany({ where: { id } });
  if (!count) return bad("Сессия не найдена", 404);
  return NextResponse.json({ ok: true });
}
