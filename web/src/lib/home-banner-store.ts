import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { activeBanner, EMPTY_BANNER, type ActiveBanner, type BannerDraft } from "@/lib/home-banner";

// Чтение и запись баннера главной. Отдельно от чистого home-banner.ts: здесь БД и файловая
// система, а тот модуль тянет клиентская форма правки.

/** Черновик (то, что лежит в форме) — сырые поля как есть. Строка одна на всю таблицу, id = 1. */
export async function readBannerDraft(): Promise<BannerDraft> {
  const row = await prisma.homeBanner.findUnique({ where: { id: 1 } });
  return row
    ? { enabled: row.enabled, image: row.image, title: row.title, text: row.text, ctaLabel: row.ctaLabel, ctaHref: row.ctaHref }
    : EMPTY_BANNER;
}

export async function writeBannerDraft(draft: BannerDraft): Promise<BannerDraft> {
  const data = { ...draft };
  await prisma.homeBanner.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  return data;
}

/**
 * Баннер, который можно показать на главной, — или null.
 *
 * Сверх правила «заполнен целиком» здесь проверяется, что файл полотна на месте: его могли
 * удалить из public/uploads руками, и тогда главная получила бы битую картинку в первом экране.
 * Дешевле сходить в stat, чем оставить лигу без первого экрана: ветка по данным честнее дырки.
 */
export async function homeBanner(): Promise<ActiveBanner | null> {
  const banner = activeBanner(await readBannerDraft());
  if (!banner) return null;
  try {
    await fs.access(path.join(process.cwd(), "public", banner.image.replace(/^\//, "")));
  } catch {
    return null;
  }
  return banner;
}
