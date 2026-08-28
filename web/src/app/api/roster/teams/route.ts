import { NextResponse } from "next/server";
import { listTeams } from "@/lib/roster-data";

// Список команд лиги (читают студия и разбор матча). Создания здесь нет: команда заводится только
// штатно — заявкой на турнир, импортом таблицы сезона или через ростер-скрипты, а не свободным вводом.
export async function GET() {
  return NextResponse.json(await listTeams());
}
