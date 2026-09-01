import { NextResponse } from "next/server";
import { searchLeague } from "@/lib/search";

// Поиск по лиге для поля в шапке сайдбара. Публичный: отдаёт ровно то, что и так открыто на
// витринах — команды, игроков и незачерновиковые турниры (фильтры внутри searchLeague).
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json({ hits: await searchLeague(q) });
}
