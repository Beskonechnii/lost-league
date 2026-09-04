import { NextResponse, type NextRequest } from "next/server";
import { verifySteamCallback, steamConfigured } from "@/lib/steam-oauth";
import { prisma } from "@/lib/prisma";
import { establishSession } from "@/lib/account";

// Возврат от Steam: проверяем подпись, заводим/находим аккаунт по steamId, выдаём сессию.
// У Steam нет почты — аккаунт остаётся без email, как у входа через Telegram.

export const dynamic = "force-dynamic";

const back = (req: NextRequest, error: string) => NextResponse.redirect(new URL(`/me?error=${error}`, req.url));

export async function GET(req: NextRequest) {
  if (!steamConfigured()) return back(req, "off");

  let user;
  try {
    user = await verifySteamCallback(req.nextUrl.searchParams);
  } catch {
    return back(req, "steam");
  }

  const existing = await prisma.userAccount.findUnique({ where: { steamId: user.steamId } });
  const account = existing
    ? await prisma.userAccount.update({
        where: { id: existing.id },
        data: { name: existing.name ?? user.name ?? null, avatar: existing.avatar ?? user.avatar ?? null },
      })
    : await prisma.userAccount.create({
        data: { steamId: user.steamId, name: user.name ?? null, avatar: user.avatar ?? null },
      });

  await establishSession(account.id);
  return NextResponse.redirect(new URL("/me", req.url));
}
