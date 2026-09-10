import { NextResponse, type NextRequest } from "next/server";
import { verifySteamCallback, steamConfigured } from "@/lib/steam-oauth";
import { prisma } from "@/lib/prisma";
import { establishSession } from "@/lib/account";
import { currentAccountId } from "@/lib/player-session";

// Возврат от Steam. Два разных дела под одним адресом:
//
//  • сессии НЕТ — это вход: находим или заводим аккаунт по steamId и выдаём сессию.
//    У Steam нет почты — аккаунт остаётся без email, как у входа через Telegram;
//  • сессия ЕСТЬ — это привязка: человек уже вошёл по почте и подтверждает свою Dota-личность
//    на шаге 2 анкеты. Сессию не трогаем, пишем steamId текущему аккаунту.
//
// Вход и привязку различаем ТОЛЬКО по наличию своей сессии, а не по параметру возврата: параметр
// подделывается, и подделка увела бы человека в чужой аккаунт (steamId — единственный ключ входа,
// у аккаунта из Steam нет ни почты, ни пароля, которыми ошибку можно было бы заметить).
//
// Ошибки не роняем страницей, а возвращаем на /me с ?error — там их печатает словарь ERRORS.

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

  // Чей это Steam по нашей базе — вопрос один и тот же для обоих режимов, поэтому спрашиваем раньше развилки.
  const owner = await prisma.userAccount.findUnique({ where: { steamId: user.steamId } });

  // Аккаунт из куки читаем из БД, а не верим id из токена: аккаунт мог быть удалён, и тогда это
  // не привязка, а обычный вход.
  const meId = await currentAccountId();
  const me = meId == null ? null : await prisma.userAccount.findUnique({ where: { id: meId } });

  if (me) {
    // Этот Steam уже за кем-то закреплён — ни привязать, ни «просто войти» им нельзя: и то и другое
    // означало бы отдать чужой профиль лиги тому, кто в него не входил. Отказ с объяснением.
    if (owner && owner.id !== me.id) return back(req, "steam-taken");
    if (!owner) {
      await prisma.userAccount.update({
        where: { id: me.id },
        // Имя и аватар — только в пустые поля: у вошедшего по почте они могли прийти из Google,
        // и подменять их персоной из Steam мы не подписывались.
        data: { steamId: user.steamId, name: me.name ?? user.name ?? null, avatar: me.avatar ?? user.avatar ?? null },
      });
    }
    // Анкету человек бросил на шаге 2, и она вернётся туда сама: перед уходом на Steam форма
    // кладёт черновик с номером шага (см. me/application-form.tsx), а /me открывает квиз по нему.
    return NextResponse.redirect(new URL("/me", req.url));
  }

  const account = owner
    ? await prisma.userAccount.update({
        where: { id: owner.id },
        data: { name: owner.name ?? user.name ?? null, avatar: owner.avatar ?? user.avatar ?? null },
      })
    : await prisma.userAccount.create({
        data: { steamId: user.steamId, name: user.name ?? null, avatar: user.avatar ?? null },
      });

  await establishSession(account.id);
  return NextResponse.redirect(new URL("/me", req.url));
}
