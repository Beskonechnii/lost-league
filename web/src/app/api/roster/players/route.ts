import { NextResponse } from "next/server";
import { listPlayers } from "@/lib/roster-data";
import { guard } from "@/lib/api-guard";

// Список игроков лиги. Создания здесь нет: игрок появляется только штатно — регистрацией (анкета →
// модерация), заявкой капитана или импортом, а не свободным вводом ника оператором.
//
// Закрыт правом ростера: строка Player отдаётся целиком, а в ней личные поля анкеты — имя, телефон,
// телеграм, дата рождения, город. Витринам этот роут не нужен (они читают `listPlayers()` на
// сервере и рисуют только ник, команду и игровые цифры), так что снаружи он остаётся операторским.
export async function GET() {
  const denied = await guard("roster.edit");
  if (denied) return denied;
  return NextResponse.json(await listPlayers());
}
