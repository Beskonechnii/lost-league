import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bad, parseId } from "@/lib/api";
import { VALID_SCORES } from "@/lib/series";
import { guard } from "@/lib/api-guard";
import { announceReschedule } from "@/lib/tg-schedule";

/**
 * Поправить счёт встречи — либо её время начала (`startAt` в теле).
 *
 * Счёт: кросс-таблица сезона не подписана, пары групповой стадии восстановлены расчётом — правка
 * здесь считается подтверждением, снимаем пометку «под вопросом». `flipped` — счёт пришёл со
 * стороны гостя, разворачиваем перед записью.
 *
 * Время: это единственный вход, из которого игроки узнают о встрече и её переносе — записав,
 * зовём `announceReschedule` (BOT-PLAN.md, Э7). Позже сюда же придёт апрув запроса встречи от
 * капитана (Э8): рассылка одна на оба пути.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard("series.edit");
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");
  const body = (await req.json()) as { score?: string; flipped?: boolean; startAt?: string | null };

  if ("startAt" in body) {
    const raw = String(body.startAt ?? "").trim();
    // Пустое поле — «времени нет», а не эпоха: по пустому startAt встреча попадает в дайджест.
    const next = raw ? new Date(raw) : null;
    if (next && Number.isNaN(next.getTime())) return bad(`Не разобрал время начала: «${raw}»`);

    const series = await prisma.series.findUnique({ where: { id }, select: { startAt: true } });
    if (!series) return bad("Встреча не найдена", 404);
    await prisma.series.update({ where: { id }, data: { startAt: next } });

    // Рассылка не влияет на ответ: время уже записано, и упавший телеграм — повод для строки в
    // консоли, а не для ошибки оператору (тот же принцип, что в tg-notify.ts).
    if (next) await announceReschedule(id, series.startAt);
    return NextResponse.json({ ok: true, startAt: next });
  }

  const score = String(body.score ?? "");
  if (!VALID_SCORES.includes(score)) {
    return bad(`Счёт серии должен быть ${VALID_SCORES.join(", ")} — не «${score}»`);
  }

  const [a, b] = score.split(":").map(Number);
  const [homeScore, awayScore] = body.flipped ? [b, a] : [a, b];

  const { count } = await prisma.series.updateMany({
    where: { id },
    data: { homeScore, awayScore, guessed: false },
  });
  if (!count) return bad("Встреча не найдена", 404);
  return NextResponse.json(await prisma.series.findUnique({ where: { id } }));
}

/** Снести встречу целиком — вместе с её картами: без серии карте в архиве места нет. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard("series.edit");
  if (denied) return denied;
  const seriesId = parseId((await params).id);
  if (!seriesId) return bad("id: ожидался числовой id");
  await prisma.match.deleteMany({ where: { seriesId } });
  const { count } = await prisma.series.deleteMany({ where: { id: seriesId } });
  if (!count) return bad("Встреча не найдена", 404);
  return NextResponse.json({ ok: true });
}
