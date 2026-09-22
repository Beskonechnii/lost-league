// Приватность витрины — ОДНО место правды о том, что из данных игроков видно публике. Страницы,
// открытые API и бот спрашивают настройку здесь: разъехаться двум местам нельзя, ровно на этом
// разъехалось ТЗ 29 (ФИО сняли со страницы игрока, а в поиске и на оверлее оно осталось).
//
// Флаг один на лигу, а не поле игрока (решение Стаса). Хранится строкой `id = 1` по образцу
// `HomeBanner`; таблицу не выгружает `scripts/export-db.ts`, поэтому `db:import` настройку не сбросит.
//
// Дефолт — «скрыто», и он же ответ на любую беду: пустая база, свежая выкатка, упавшее чтение.
// Приватность не должна зависеть от того, успел ли кто-то нажать кнопку.
//
// Читается на каждое обращение, как `bot-settings.ts`: бот живёт долгоживущим процессом, и
// настройка, требующая перезапуска, — это настройка, которая не работает.

import { prisma } from "./prisma";

export type Privacy = {
  /** Показывать ли телеграм игроков вне служебной части. */
  telegram: boolean;
  /** Показывать ли MMR и всё, что из него считается. */
  mmr: boolean;
};

/** Состояние «лига закрыта»: и дефолт пустой базы, и ответ на любую ошибку чтения. */
export const PRIVACY_HIDDEN: Privacy = { telegram: false, mmr: false };

/**
 * Настройка вместе с признаком «прочиталась ли». Нужна только экрану правки: он обязан сказать
 * оператору, что показывает дефолт из-за ошибки, а не сохранённое значение.
 */
export async function readPrivacy(): Promise<{ value: Privacy; ok: boolean }> {
  try {
    const row = await prisma.privacySetting.findUnique({ where: { id: 1 } });
    return { value: row ? { telegram: row.showTelegram, mmr: row.showMmr } : PRIVACY_HIDDEN, ok: true };
  } catch {
    return { value: PRIVACY_HIDDEN, ok: false };
  }
}

/** Настройка для витрин: не падает никогда, в худшем случае отдаёт «скрыто». */
export async function privacy(): Promise<Privacy> {
  return (await readPrivacy()).value;
}

/** Короткий вопрос про MMR — им спрашивает большинство поверхностей. */
export const mmrShown = async (): Promise<boolean> => (await privacy()).mmr;

/** Короткий вопрос про телеграм. */
export const telegramShown = async (): Promise<boolean> => (await privacy()).telegram;

export async function writePrivacy(next: Privacy): Promise<Privacy> {
  const data = { showTelegram: next.telegram, showMmr: next.mmr };
  await prisma.privacySetting.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  return next;
}

/**
 * Вычистить MMR из произвольного снимка — по ключу, а не по типу.
 *
 * Нужен там, где наружу уходит сохранённый payload, а не собранный нами DTO: снимок сессии драфта
 * лежит в базе с тем форматом, какой был при записи, и в старых сессиях MMR уже записан. Переписывать
 * их не надо — достаточно не отдавать: и в JSON открытого роута, и в payload страницы оверлея.
 */
export function withoutMmr(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutMmr);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, k === "mmr" ? null : withoutMmr(v)]),
    );
  }
  return value;
}
