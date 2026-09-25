import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { establishSession } from "@/lib/account";

// Стенд 42а: «войти как» одним адресом. `/dev/as/<accountId>` ставит куку сессии этого аккаунта и
// уводит на главную — прогон лобби на двенадцать человек открывается копипастой в двенадцать
// вкладок, а не двенадцатью входами по паролю.
//
// Замка два, а не один: вне production (как `DEV_LOGIN_EMAIL`, player-session.ts) И только при
// `DEV_AS=1`. Случайно запущенная dev-сборка на чужой машине иначе раздавала бы чужие сессии
// всякому, кто угадал число в адресе.
//
// Кука настоящая, подписанная — поэтому переключение аккаунта не требует перезапуска процесса:
// память процесса (`devSessionCache`) живёт в пути `DEV_LOGIN_EMAIL`, где куки нет вовсе, и этого
// пути не касается.

export const dynamic = "force-dynamic";

const off = () => process.env.NODE_ENV === "production" || (process.env.DEV_AS ?? "").trim() !== "1";

const notFound = () => new NextResponse("Not Found", { status: 404 });

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (off()) return notFound();

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return notFound();
  const account = await prisma.userAccount.findUnique({ where: { id }, select: { id: true } });
  if (!account) return notFound();

  await establishSession(account.id);
  return NextResponse.redirect(new URL("/", req.url));
}
