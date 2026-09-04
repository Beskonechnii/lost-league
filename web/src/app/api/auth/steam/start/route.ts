import { NextResponse, type NextRequest } from "next/server";
import { steamConfigured, steamLoginUrl } from "@/lib/steam-oauth";

// Старт входа через Steam: сразу уводим на OpenID-провайдера, отдельного state не заводим —
// подпись обратного ответа проверяет сам Steam (см. lib/steam-oauth.ts).

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!steamConfigured()) return NextResponse.redirect(new URL("/me?error=off", req.url));
  return NextResponse.redirect(steamLoginUrl(req.nextUrl.origin));
}
