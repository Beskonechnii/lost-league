import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { draftPool } from "@/lib/draft-data";
import { type DraftState } from "@/lib/draft";
import { mmrShown, withoutMmr } from "@/lib/privacy";
import { ECLIPSE_PARTNER } from "@/lib/partners";
import { OverlayLive } from "./_components/overlay-live";

export const dynamic = "force-dynamic";

// «Голый» оверлей результата драфта для OBS-сцены: только составы, без операторских кнопок.
// Публичный (см. needsAdmin): у OBS админской куки нет. Игроки резолвятся из ростера по id.
// Рендер живой — OverlayLive опрашивает сессию и перерисовывается по ходу драфта.

export default async function OverlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, showMmr] = await Promise.all([
    prisma.draftSession.findUnique({ where: { id: Number(id) }, include: { draftSettings: { select: { tournament: { select: { id: true, kind: true } } } } } }),
    mmrShown(),
  ]);
  // Роли одиночных участников (ТЗ 38) живут у записей турнира — пул собираем, зная его.
  const full = await draftPool(session?.draftSettings?.tournament?.id);
  // Оверлей открыт без входа (OBS ходит сюда без куки), поэтому закрытые поля снимаем до рендера:
  // иначе они уезжают и в эфир, и в payload страницы (DECISIONS 18.09.2026). В админском драфте
  // тот же пул остаётся полным — там по нему ищут человека.
  const pool = full.map((p) => ({ ...p, realName: null, mmr: showMmr ? p.mmr : null }));
  if (!session) notFound();

  let state: DraftState;
  try {
    const parsed = JSON.parse(session.payload) as unknown;
    // Снимок сессии уезжает в клиентский компонент целиком, то есть и в RSC-payload страницы.
    // Нынешний формат держит только id, но снимки старых сессий писали и пул с MMR — их не
    // переписываем, а просто не отдаём (тот же скребок, что у открытого GET сессии).
    state = (showMmr ? parsed : withoutMmr(parsed)) as DraftState;
  } catch {
    notFound();
  }

  return (
    <OverlayLive
      sessionId={session.id}
      initialState={state}
      pool={pool}
      showMmr={showMmr}
      // Знак партнёра — только у Mix Cup: он партнёрское событие, а UNDERBEER (и турнирный,
      // и ad hoc) идёт без организатора со стороны.
      partner={session.draftSettings?.tournament.kind === "mixcup" ? ECLIPSE_PARTNER : undefined}
    />
  );
}
