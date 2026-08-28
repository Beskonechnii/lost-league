import { NextResponse } from "next/server";
import { listPlayers } from "@/lib/roster-data";

// Список игроков лиги. Создания здесь нет: игрок появляется только штатно — регистрацией (анкета →
// модерация), заявкой капитана или импортом, а не свободным вводом ника оператором.
export async function GET() {
  return NextResponse.json(await listPlayers());
}
