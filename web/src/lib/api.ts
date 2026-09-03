// Общие мелочи API-роутов: единый формат ошибки и разбор числового id из адреса.
//
// Зачем. Раньше каждый роут заводил свой `bad()` и по-своему брал `Number(id)`. Отсюда расхождения:
// на нечисловой id одни отвечали честной 400, другие роняли 500 из Prisma (`Number("x") → NaN`).
// Здесь одно место правды — подключается из роутов, а не копируется в каждый.

import { NextResponse } from "next/server";

/** Ответ-ошибка в том же виде, что и везде: `{ error }`. */
export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Положительное целое из сегмента адреса или из поля JSON-тела, иначе null (значит 400, а не
 * падение в Prisma). Число на входе допускается намеренно: в теле запроса id приходит числом,
 * и оборачивать его в String ради этой проверки — шум на каждом вызове.
 */
export function parseId(raw: string | number | null | undefined): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}
