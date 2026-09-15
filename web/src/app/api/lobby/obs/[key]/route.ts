import { NextResponse } from "next/server";
import { bad } from "@/lib/api";
import { readBoard, touchLobby } from "@/lib/lobby";

// Борд комнаты для ОБС-вида. ПУБЛИЧНЫЙ и без куки — иначе браузерный источник OBS не открыл бы
// его вовсе (ТЗ 22в §6). Закрывает чужую встречу неугадываемость ключа, а не сессия; отдаётся по
// нему только картинка драфта: ни состава комнаты, ни чата, ни кнопок (см. `readBoard`).
//
// Испорченный ключ — 404, как и у самой комнаты: «такого нет» и «сюда нельзя» снаружи неотличимы.

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const key = (await params).key;
  const found = await readBoard(key);
  if (!found) return bad("Не найдено", 404);
  // Часы досчитываются и здесь: эфирная вкладка может оказаться единственной открытой, и тогда
  // автоход обязан наступить от её обращения — а не ждать, пока комнату тронет кто-то живой.
  await touchLobby(found.id);
  const after = await readBoard(key);
  return NextResponse.json((after ?? found).board, { headers: { "Cache-Control": "no-store" } });
}
