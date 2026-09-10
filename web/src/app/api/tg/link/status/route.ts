import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAccountId } from "@/lib/player-session";

// «Уже привязали?» — вкладка, из которой ушли в бота, спрашивает об этом каждые несколько секунд
// (`me/telegram-link.tsx`). Привязка случается в другом процессе (бот принял Start), и узнать о ней
// странице больше неоткуда: своего пуша с сервера у нас нет.
//
// Отдаём ровно два поля своего аккаунта — ничего чужого здесь не спросить.

export const dynamic = "force-dynamic";

export async function GET() {
  const accountId = await currentAccountId();
  if (accountId == null) return NextResponse.json({ linked: false, username: null }, { status: 401 });

  const account = await prisma.userAccount.findUnique({
    where: { id: accountId },
    select: { tgId: true, tgUsername: true },
  });
  return NextResponse.json(
    { linked: !!account?.tgId, username: account?.tgUsername ?? null },
    { headers: { "cache-control": "no-store" } },
  );
}
