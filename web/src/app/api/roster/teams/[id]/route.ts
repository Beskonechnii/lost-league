import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bad, parseId } from "@/lib/api";
import { isColor } from "@/lib/profiles";
import { guard } from "@/lib/api-guard";

// Редактируемые поля профиля команды. Всё, чего нет в теле запроса, не трогаем.
const FIELDS = ["name", "tag", "group", "color", "logo", "wordmark", "photo", "banner"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard("roster.edit");
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");
  const body = (await req.json()) as Record<string, string | null>;

  const data: Record<string, string | null> = {};
  for (const f of FIELDS) {
    if (f in body) data[f] = body[f]?.toString().trim() || null;
  }
  if (data.name === null) return bad("Название не может быть пустым");
  // color уходит в CSS-стили карточек — пускаем только hex, иначе можно вписать что угодно в стиль
  if (data.color && !isColor(data.color)) return bad(`Цвет «${data.color}» — ожидался hex, например #7c3aed`);

  const { count } = await prisma.team.updateMany({ where: { id }, data });
  if (!count) return bad("Команда не найдена", 404);
  return NextResponse.json(await prisma.team.findUnique({ where: { id } }));
}

/**
 * Удаление команды — двухэтапное (см. Team.archivedAt в схеме и таб «Ростер»):
 *   ?mode=archive (по умолчанию) — «первое удаление»: команда уходит из общего пула в архив, но её
 *     прошлые таблицы/матчи/серии целы. Обратимо (POST .../restore).
 *   ?mode=purge — «второе удаление»: физический снос со всей историей. Разрешён только для уже
 *     архивной команды — случайно снести боевую команду со статистикой в один клик нельзя.
 * Оба этапа под правом `roster.delete` (отдельным от правки: действие разрушительное).
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard("roster.delete");
  if (denied) return denied;
  const teamId = parseId((await params).id);
  if (!teamId) return bad("id: ожидался числовой id");

  const mode = new URL(req.url).searchParams.get("mode") ?? "archive";
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { archivedAt: true } });
  if (!team) return bad("Команда не найдена", 404);

  if (mode === "archive") {
    // Идемпотентно: повторный архив дату не двигает — «когда убрали» важнее «когда нажали ещё раз».
    if (!team.archivedAt) {
      await prisma.team.update({ where: { id: teamId }, data: { archivedAt: new Date() } });
    }
    return NextResponse.json({ ok: true, archived: true });
  }

  if (mode !== "purge") return bad(`mode: ожидался archive или purge, получено «${mode}»`);
  // Полный снос — только из архива: сперва первое удаление, потом второе. Так один клик не сносит
  // команду со статистикой, а оператор видит её в архиве перед окончательным удалением.
  if (!team.archivedAt) return bad("Сначала уберите команду в архив, потом удаляйте полностью", 409);

  // Матчи на команду ссылаются без каскада (иначе случайное удаление рвало бы историю) — сносим их
  // явно вместе со статой и вардами (те каскадятся от матча). Денормализованный Ward.teamId, что мог
  // остаться от нераспознанных матчей, обнуляем. Остальное (составы, участие, серии, места в группе)
  // уходит каскадом при удалении команды. Всё в транзакции — либо команда исчезает целиком, либо никак.
  await prisma.$transaction([
    prisma.match.deleteMany({ where: { OR: [{ teamAId: teamId }, { teamBId: teamId }] } }),
    prisma.ward.updateMany({ where: { teamId }, data: { teamId: null } }),
    prisma.team.delete({ where: { id: teamId } }),
  ]);
  return NextResponse.json({ ok: true, purged: true });
}
