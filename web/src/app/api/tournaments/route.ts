import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/api-guard";
import { isTournamentKind } from "@/lib/tournaments";

// Быстрое заведение турнира индивидуального формата — короткий путь с «Новый Mix Cup» на
// /admin/mixcup (полный путь с выбором формата — мастер /admin/tournaments/new). Список читает
// страница напрямую из Prisma, отдельного GET здесь нет: он никем не читается.
//
// Слаг зависит от id (конвенция проекта: ставится один раз и не меняется), а id известен только
// после вставки — поэтому строка правится вторым запросом.
//
// Mix Cup — один бренд-партнёр (Eclipse, src/lib/partners.ts), один пул игроков на все события:
// новый mixcup наследует регистрации турнира-эталона `eclipse` (ТЗ 43), а не начинается пустым —
// оператору не нужно каждый раз звать скрипт импорта заново. UNDERBEER своего пула не имеет.
const ECLIPSE_POOL_SLUG = "eclipse";

async function copyEclipsePool(tournamentId: number) {
  const eclipse = await prisma.tournament.findUnique({ where: { slug: ECLIPSE_POOL_SLUG }, select: { id: true } });
  if (!eclipse || eclipse.id === tournamentId) return;
  const registrations = await prisma.tournamentRegistration.findMany({
    where: { tournamentId: eclipse.id },
    select: { accountId: true, playerId: true, desiredRoles: true },
  });
  if (!registrations.length) return;
  await prisma.tournamentRegistration.createMany({
    data: registrations.map((r) => ({ ...r, tournamentId })),
  });
}

export async function POST(req: Request) {
  const denied = await guard("tournaments.edit");
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as { kind?: string };
  const kind = body.kind ?? "mixcup";
  if (!isTournamentKind(kind) || kind === "season")
    return NextResponse.json({ error: "Ожидался индивидуальный формат турнира" }, { status: 400 });

  const created = await prisma.tournament.create({
    data: { slug: `${kind}-${Date.now()}`, name: kind === "mixcup" ? "Mix Cup" : "UNDERBEER", kind, draftSettings: { create: {} } },
  });
  const slug = `${kind}-${created.id}`;
  const taken = await prisma.tournament.findFirst({ where: { slug, id: { not: created.id } }, select: { id: true } });
  const tournament = await prisma.tournament.update({
    where: { id: created.id },
    data: {
      slug: taken ? `${slug}-${Date.now()}` : slug,
      name: `${kind === "mixcup" ? "Mix Cup" : "UNDERBEER"} #${created.id}`,
    },
  });
  if (kind === "mixcup") await copyEclipsePool(tournament.id);
  return NextResponse.json(tournament, { status: 201 });
}
