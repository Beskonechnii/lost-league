import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { draftPool } from "@/lib/draft-data";
import { type DraftState } from "@/lib/draft";
import { OverlayLive } from "./_components/overlay-live";

export const dynamic = "force-dynamic";

// «Голый» оверлей результата драфта для OBS-сцены: только составы, без операторских кнопок.
// Публичный (см. needsAdmin): у OBS админской куки нет. Игроки резолвятся из ростера по id.
// Рендер живой — OverlayLive опрашивает сессию и перерисовывается по ходу драфта.

export default async function OverlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, full] = await Promise.all([
    prisma.draftSession.findUnique({ where: { id: Number(id) } }),
    draftPool(),
  ]);
  // Оверлей открыт без входа (OBS ходит сюда без куки), поэтому настоящее имя снимаем до рендера:
  // иначе оно уезжает и в эфир, и в payload страницы (DECISIONS 18.09.2026). В админском драфте
  // тот же пул остаётся с именем — там по нему ищут человека.
  const pool = full.map((p) => ({ ...p, realName: null }));
  if (!session) notFound();

  let state: DraftState;
  try {
    state = JSON.parse(session.payload) as DraftState;
  } catch {
    notFound();
  }

  return <OverlayLive sessionId={session.id} initialState={state} pool={pool} />;
}
