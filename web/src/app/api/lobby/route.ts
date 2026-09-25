import { NextResponse } from "next/server";
import { bad, parseId } from "@/lib/api";
import { createLobby, currentViewer } from "@/lib/lobby";
import { DEFAULT_MAIN_SEC, DEFAULT_RESERVE_SEC } from "@/lib/fearless";

// Создание лобби. С 42б это инструмент ОРГАНИЗАТОРА: право `tools` проверяет `canCreateLobby`
// внутри, и сюда приходят название, пароль и имена сторон — составов в комнате ещё нет.

type Body = {
  title?: string;
  password?: string;
  sideAName?: string;
  sideBName?: string;
  mainSec?: number;
  reserveSec?: number;
  bestOf?: number;
  seriesId?: number | null;
};

/** Секунды из формы: положительное целое, иначе дефолт движка. Тайминги — настройка встречи. */
const secs = (raw: unknown, fallback: number): number => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n <= 3600 ? n : fallback;
};

export async function POST(req: Request) {
  const viewer = await currentViewer();
  if (!viewer) return bad("Нужно войти", 401);

  const body = (await req.json().catch(() => ({}))) as Body;
  const title = body.title?.trim();
  if (!title) return bad("Назовите встречу");
  const password = body.password?.trim();
  if (!password) return bad("Задайте пароль комнаты");

  const result = await createLobby({
    title,
    password,
    // Имена сторон — свободный текст; пусто заменяем подписью по умолчанию, чтобы в эфире не
    // оказалось безымянной колонки.
    sideAName: body.sideAName?.trim() || "Сторона A",
    sideBName: body.sideBName?.trim() || "Сторона B",
    mainSec: secs(body.mainSec, DEFAULT_MAIN_SEC),
    reserveSec: secs(body.reserveSec, DEFAULT_RESERVE_SEC),
    bestOf: [1, 2, 3, 5].includes(Number(body.bestOf)) ? Number(body.bestOf) : 3,
    seriesId: parseId(body.seriesId),
  });
  if (!result.ok) return bad(result.error, 403);
  return NextResponse.json({ id: result.id }, { status: 201 });
}
