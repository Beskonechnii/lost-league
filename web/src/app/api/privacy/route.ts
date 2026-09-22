import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { currentRole } from "@/lib/account";
import { guard } from "@/lib/api-guard";
import { readPrivacy, writePrivacy } from "@/lib/privacy";

// Показ телеграма и MMR: чтение под правом `privacy`, запись — только владельцу.
//
// Право открывает ПРОСМОТР: оператор должен знать, открыты ли сейчас данные, с которыми он
// работает в модерации и импорте. Переключает показ владелец (`OWNER_EMAIL`) — решение Стаса,
// и проверяется оно здесь, а не только экраном: страницу можно и не открывать.

export async function GET() {
  const denied = await guard("privacy");
  if (denied) return denied;
  return NextResponse.json((await readPrivacy()).value);
}

export async function PATCH(req: Request) {
  const denied = await guard("privacy");
  if (denied) return denied;
  if ((await currentRole()) !== "owner") {
    return NextResponse.json({ error: "Показ переключает владелец лиги (OWNER_EMAIL)" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ожидался объект настройки" }, { status: 400 });
  }
  // Всё, что не явное `true`, — «скрыто»: у приватности нет третьего состояния, и мусор в теле
  // запроса должен закрывать данные, а не открывать.
  const next = { telegram: body.telegram === true, mmr: body.mmr === true };
  await writePrivacy(next);
  // Показ меняет публичные витрины целиком — от страницы игрока до оверлея, поэтому путь "/"
  // со scope "layout", как у темы: точечный список страниц разъехался бы с первой новой витриной.
  revalidatePath("/", "layout");
  return NextResponse.json(next);
}
