// Турниры индивидуального формата (ТЗ 33/34, обобщены ТЗ 37): запись игрока поодиночке и
// durable-результат драфта. Сам движок драфта — один на всех (src/lib/draft.ts); здесь лежит то,
// чего в движке нет.
//
// Запись общая для обоих форматов (mixcup и underbeer) — одна таблица TournamentRegistration и
// один путь входа. А вот перенос результата в строки (MixCupTeam/MixCupPick) остаётся
// привилегией mixcup: у UNDERBEER-турнира результат по-прежнему эфемерен (DECISIONS 22.09.2026,
// ТЗ 37 «НЕ входит»).

import "server-only";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { draftPool } from "./draft-data";
import { memberIds, type DraftState } from "./draft";
import { parseApplication } from "./application";
import { createPlayerFromApplication } from "./account";

/**
 * Перенести результат закончившегося драфта в durable-строки турнира: команды и пики строками,
 * ник — снимком на СЕЙЧАС (пул ещё живой сразу после эфира). Зеркало, не слияние — старый
 * результат того же турнира сносится целиком (та же семантика, что у import-db.ts для
 * производных строк): у турнира один актуальный состав, а не история пересборок.
 */
export async function persistMixCupResult(tournamentId: number, state: DraftState): Promise<void> {
  const pool = await draftPool();
  const byId = new Map(pool.map((p) => [p.id, p]));

  await prisma.mixCupTeam.deleteMany({ where: { tournamentId } }); // каскадом сносит и пики
  for (const [orderNo, team] of state.teams.entries()) {
    await prisma.mixCupTeam.create({
      data: {
        tournamentId,
        name: team.name,
        color: team.color,
        orderNo,
        picks: {
          create: memberIds(team).map((pid, pickOrder) => {
            const p = byId.get(pid);
            return {
              playerId: p ? pid : null,
              nickname: p?.nickname ?? `#${pid}`,
              isCaptain: team.captainId === pid,
              orderNo: pickOrder,
            };
          }),
        },
      },
    });
  }
  await prisma.tournament.update({ where: { id: tournamentId }, data: { status: "finished" } });
}

// ── запись игрока (ТЗ 34, общая для обоих форматов с ТЗ 37) ──────────────────────────────────
//
// Дверь в пул игроков, а не витрина: гость доходит до записи в один заход, попадая в пул драфта
// ДО апрува анкеты (исключение из «сначала модерация, потом ростер», решение Стаса 22.09.2026).

/** Кука-намерение «шёл сюда ради записи»: ставится по клику «Участвовать» гостем (route-хендлер
 *  /api/join/[slug]/intent) и переживает весь путь входа/анкеты, включая внешний редирект на
 *  Google — кука не завязана на query-параметры, поэтому не теряется. Разбирается на /me (см.
 *  MixCupIntentConsumer): как только профиля хватает для записи, человека уводит обратно на
 *  турнир уже записанным, без второго клика «Участвовать» (acceptance ТЗ 34). */
const INTENT_COOKIE = "lost_mixcup_intent";

export async function setJoinIntent(slug: string): Promise<void> {
  (await cookies()).set(INTENT_COOKIE, slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 1800, // 30 минут — дольше держать смысла нет: за это время вход/анкета проходятся
  });
}

export async function readJoinIntentSlug(): Promise<string | null> {
  return (await cookies()).get(INTENT_COOKIE)?.value ?? null;
}

export async function clearJoinIntent(): Promise<void> {
  (await cookies()).delete(INTENT_COOKIE);
}

export type JoinResult =
  | { ok: true }
  // closed — приёма уже нет (турнир закрыли/сыграли, пока человек проходил анкету или логин);
  // no-profile — записывать пока нечем: ни готового профиля, ни отправленной анкеты.
  | { ok: false; reason: "closed" | "no-profile" };

/** Приём записи открыт: у индивидуального формата это ровно «Приём заявок» у турнира. Одно место
 *  правды — его спрашивают и страница записи, и сама запись, и разбор куки-намерения. */
export const joinOpen = (t: { kind: string; status: string }): boolean =>
  t.kind !== "season" && t.status === "registration";

/**
 * Записать аккаунт на турнир индивидуального формата. Порядок поиска профиля: уже привязанный
 * игрок (playerId) → заявка на привязку к существующему (claimId, тоже реальный игрок) → уже
 * заведённый ранее теневой профиль этого же аккаунта (повторная запись/повторный заход) → новый
 * теневой профиль из анкеты (verified: false — до публичных витрин он не доходит).
 *
 * Идемпотентно: повторный вызов для уже записанного аккаунта ничего не ломает.
 */
export async function registerForTournament(accountId: number, tournamentId: number): Promise<JoinResult> {
  const [tournament, account] = await Promise.all([
    prisma.tournament.findUnique({ where: { id: tournamentId }, select: { kind: true, status: true } }),
    prisma.userAccount.findUnique({ where: { id: accountId } }),
  ]);
  if (!tournament || !joinOpen(tournament)) return { ok: false, reason: "closed" };
  if (!account) return { ok: false, reason: "no-profile" };

  let playerId = account.playerId ?? account.claimId ?? null;
  if (playerId == null) {
    const shadow = await prisma.tournamentRegistration.findFirst({ where: { accountId }, select: { playerId: true } });
    if (shadow) {
      playerId = shadow.playerId;
    } else {
      const app = parseApplication(account.application);
      if (!app) return { ok: false, reason: "no-profile" }; // анкеты ещё нет — записывать нечем
      playerId = await createPlayerFromApplication(app, app.mmr, { verified: false, sourceTournamentId: tournamentId });
    }
  }

  await prisma.tournamentRegistration.upsert({
    where: { tournamentId_accountId: { tournamentId, accountId } },
    create: { tournamentId, accountId, playerId },
    update: { playerId }, // на случай повторной записи после апрува — подтягиваем актуальный id
  });
  return { ok: true };
}

/** Отменить запись — доступно только пока приём открыт (проверяет вызывающая сторона). Профиль
 *  не трогаем: второй справочник не заводим, а сам человек остаётся в пуле лиги как есть. */
export async function unregisterFromTournament(accountId: number, tournamentId: number): Promise<void> {
  await prisma.tournamentRegistration.deleteMany({ where: { accountId, tournamentId } });
}
