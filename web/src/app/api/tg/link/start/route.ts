import { NextResponse, type NextRequest } from "next/server";
import { currentAccountId } from "@/lib/player-session";
import { issueLinkUrl } from "@/lib/tg-link";

// Старт привязки телеграма (Э19): выдаём вошедшему одноразовый токен и уводим в бота.
//
// Роутом, а не серверным экшеном, ровно по той же причине, что и вход через Steam: переход наружу
// делает браузер сам по обычной ссылке — её не блокирует всплывашками и она работает без JS.
// Токен выдаётся на аккаунт из КУКИ, из запроса не берётся ничего: иначе ссылку можно было бы
// подсунуть чужую.

export const dynamic = "force-dynamic";

/** Куда вернуть при отказе: только внутренний путь, иначе ссылка стала бы открытым редиректом. */
function backTo(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/me/settings";
}

export async function GET(req: NextRequest) {
  const back = backTo(req.nextUrl.searchParams.get("back"));
  const accountId = await currentAccountId();
  if (accountId == null) return NextResponse.redirect(new URL("/me", req.url));

  const url = await issueLinkUrl(accountId);
  // Бота нет в окружении или Telegram не ответил — ссылку не выдумываем: она выглядела бы рабочей.
  if (!url) return NextResponse.redirect(new URL(`${back}?error=tg-off`, req.url));
  return NextResponse.redirect(url);
}
