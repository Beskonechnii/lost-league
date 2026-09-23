// Mix Cup by Eclipse (ТЗ 33) — событие вокруг того же движка драфта, что и UNDERBEER 2.0
// (src/lib/draft.ts). Здесь лежит то, чего в движке нет: статус события, слаг, и перенос
// результата из живого payload'а в durable-строки (MixCupTeam/MixCupPick), когда драфт
// доходит до фазы done. UNDERBEER этого шага не делает — его результат остаётся эфемерным
// (DECISIONS 22.09.2026).

import "server-only";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { slugify } from "./profiles";
import { draftPool } from "./draft-data";
import { memberIds, type DraftState } from "./draft";
import { parseApplication } from "./application";
import { createPlayerFromApplication } from "./account";
import type { AlertTone } from "@/components/pouf/feedback";

export type MixCupStatus = "open" | "closed" | "done";

export const MIXCUP_STATUS_LABELS: Record<MixCupStatus, string> = {
  open: "Приём открыт",
  closed: "Приём закрыт",
  done: "Сыгран",
};

// Тона — тем же словарём, что уже принят для турниров (app/_components/tournament-status.tsx):
// приём — info (действие возможно сейчас), закрыт — neutral, сыгран — итог, но уже история (warn).
export const MIXCUP_STATUS_TONE: Record<MixCupStatus, AlertTone | "neutral"> = {
  open: "info",
  closed: "neutral",
  done: "warn",
};

export function isMixCupStatus(v: string): v is MixCupStatus {
  return v === "open" || v === "closed" || v === "done";
}

/** Слаг Mix Cup: ставится один раз при заведении события (конвенция проекта — slug стабилен). */
export async function uniqueMixCupSlug(title: string | null, id: number): Promise<string> {
  const base = (title && slugify(title)) || `mixcup-${id}`;
  const taken = await prisma.mixCupEvent.findFirst({ where: { slug: base, id: { not: id } }, select: { id: true } });
  return taken ? `${base}-${id}` : base;
}

/**
 * Перенести результат закончившегося драфта в durable-строки события: команды и пики строками,
 * ник — снимком на СЕЙЧАС (пул ещё живой сразу после эфира). Зеркало, не слияние — старый
 * результат того же события сносится целиком (та же семантика, что у import-db.ts для
 * производных строк): у события один актуальный состав, а не история пересборок.
 */
export async function persistMixCupResult(eventId: number, state: DraftState): Promise<void> {
  const pool = await draftPool();
  const byId = new Map(pool.map((p) => [p.id, p]));

  await prisma.mixCupTeam.deleteMany({ where: { eventId } }); // каскадом сносит и пики
  for (const [orderNo, team] of state.teams.entries()) {
    await prisma.mixCupTeam.create({
      data: {
        eventId,
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
  await prisma.mixCupEvent.update({ where: { id: eventId }, data: { status: "done" satisfies MixCupStatus } });
}

// ── регистрация игрока (ТЗ 34) ───────────────────────────────────────────────────────────────
//
// Дверь в пул игроков, а не витрина: гость доходит до записи в один заход, попадая в пул драфта
// ДО апрува анкеты (исключение из «сначала модерация, потом ростер», решение Стаса 22.09.2026).

/** Кука-намерение «шёл сюда ради Mix Cup»: ставится по клику «Участвовать» гостем (route-хендлер
 *  ниже, /api/mixcup/event/[slug]/intent) и переживает весь путь входа/анкеты, включая внешний
 *  редирект на Google — кука не завязана на query-параметры, поэтому не теряется. Разбирается на
 *  /me (см. MixCupIntentConsumer): как только профиля хватает для записи, человека уводит обратно
 *  на событие уже записанным, без второго клика «Участвовать» (acceptance ТЗ 34). */
const INTENT_COOKIE = "lost_mixcup_intent";

export async function setMixCupIntent(slug: string): Promise<void> {
  (await cookies()).set(INTENT_COOKIE, slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 1800, // 30 минут — дольше держать смысла нет: за это время вход/анкета проходятся
  });
}

export async function readMixCupIntentSlug(): Promise<string | null> {
  return (await cookies()).get(INTENT_COOKIE)?.value ?? null;
}

export async function clearMixCupIntent(): Promise<void> {
  (await cookies()).delete(INTENT_COOKIE);
}

export type MixCupJoinResult =
  | { ok: true }
  // closed — приёма уже нет (событие закрыли/сыграли, пока человек проходил анкету или логин);
  // no-profile — записывать пока нечем: ни готового профиля, ни отправленной анкеты.
  | { ok: false; reason: "closed" | "no-profile" };

/**
 * Записать аккаунт на Mix Cup. Порядок поиска профиля: уже привязанный игрок (playerId) →
 * заявка на привязку к существующему (claimId, тоже реальный игрок) → уже заведённый ранее
 * теневой профиль этого же аккаунта (повторная запись/повторный заход) → новый теневой профиль
 * из анкеты (verified: false — до публичных витрин он не доходит, см. Player.verified).
 *
 * Идемпотентно: повторный вызов для уже записанного аккаунта ничего не ломает.
 */
export async function registerForMixCup(accountId: number, eventId: number): Promise<MixCupJoinResult> {
  const [event, account] = await Promise.all([
    prisma.mixCupEvent.findUnique({ where: { id: eventId } }),
    prisma.userAccount.findUnique({ where: { id: accountId } }),
  ]);
  if (!event || event.status !== "open") return { ok: false, reason: "closed" };
  if (!account) return { ok: false, reason: "no-profile" };

  let playerId = account.playerId ?? account.claimId ?? null;
  if (playerId == null) {
    const shadow = await prisma.mixCupRegistration.findFirst({ where: { accountId }, select: { playerId: true } });
    if (shadow) {
      playerId = shadow.playerId;
    } else {
      const app = parseApplication(account.application);
      if (!app) return { ok: false, reason: "no-profile" }; // анкеты ещё нет — записывать нечем
      playerId = await createPlayerFromApplication(app, app.mmr, { verified: false, mixCupSourceEventId: eventId });
    }
  }

  await prisma.mixCupRegistration.upsert({
    where: { eventId_accountId: { eventId, accountId } },
    create: { eventId, accountId, playerId },
    update: { playerId }, // на случай повторной записи после апрува — подтягиваем актуальный id
  });
  return { ok: true };
}

/** Отменить запись — доступно только пока приём открыт (проверяет вызывающая сторона). Профиль
 *  не трогаем: второй справочник не заводим, а сам человек остаётся в пуле лиги как есть. */
export async function unregisterFromMixCup(accountId: number, eventId: number): Promise<void> {
  await prisma.mixCupRegistration.deleteMany({ where: { accountId, eventId } });
}
