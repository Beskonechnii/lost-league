import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { draftPool } from "@/lib/draft-data";
import { type DraftState } from "@/lib/draft";
import { mmrShown, withoutMmr } from "@/lib/privacy";
import { ECLIPSE_PARTNER } from "@/lib/partners";
import { OverlayLive } from "./_components/overlay-live";
import { OverlayMixCup } from "./_components/overlay-mixcup";

export const dynamic = "force-dynamic";

// «Голый» оверлей результата драфта для OBS-сцены: только составы, без операторских кнопок.
// Публичный (см. needsAdmin): у OBS админской куки нет. Игроки резолвятся из ростера по id.
// Рендер живой — вид опрашивает сессию и перерисовывается по ходу драфта.
//
// Видов два: обычный UNDERBEER (накладка поверх игры) и сцена Mix Cup (ТЗ 44 — 8 команд, пул и
// полоса знаков на весь экран 1920×1080). Разводит их kind турнира: правка эфира партнёрского
// события не должна менять вид чужого инструмента.

export default async function OverlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, leagueShowsMmr] = await Promise.all([
    prisma.draftSession.findUnique({ where: { id: Number(id) }, include: { draftSettings: { select: { tournament: { select: { id: true, kind: true } } } } } }),
    mmrShown(),
  ]);
  if (!session) notFound();

  const isMixCup = session.draftSettings?.tournament.kind === "mixcup";
  // MMR на эфире Mix Cup виден независимо от флага лиги (DECISIONS 26.09.2026): это открытый
  // микс-турнир, где по MMR собирают составы, и прятать его на своей же сцене незачем.
  const showMmr = leagueShowsMmr || isMixCup;

  // Роли одиночных участников (ТЗ 38) живут у записей турнира — пул собираем, зная его.
  const full = await draftPool(session.draftSettings?.tournament.id);
  // Оверлей открыт без входа (OBS ходит сюда без куки), поэтому закрытые поля снимаем до рендера:
  // иначе они уезжают и в эфир, и в payload страницы (DECISIONS 18.09.2026). В админском драфте
  // тот же пул остаётся полным — там по нему ищут человека.
  const pool = full.map((p) => ({ ...p, realName: null, mmr: showMmr ? p.mmr : null }));

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

  return isMixCup ? (
    <OverlayMixCup
      sessionId={session.id}
      initialState={state}
      pool={pool}
      showMmr={showMmr}
      background={ECLIPSE_PARTNER.background}
    />
  ) : (
    <OverlayLive sessionId={session.id} initialState={state} pool={pool} showMmr={showMmr} />
  );
}
