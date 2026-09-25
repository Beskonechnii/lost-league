// Справочник героев для борда драфта: портрет + анимированный рендер, если он у нас лежит.
//
// Один список на комнату и на ОБС-вид: картинка в эфире обязана совпадать с той, что видят
// капитаны, а собирать её двумя копиями на двух страницах — верный способ разойтись.
//
// Набор webm НЕПОЛНЫЙ по определению (ТЗ 42г §6): ролики качает `scripts/sync-hero-videos.ts`,
// и герою без ролика кнопка пула показывает PNG — это норма, а не ошибка. Что реально лежит,
// говорит манифест закачки; диск на каждый рендер мы не трогаем.

import { readFileSync } from "node:fs";
import path from "node:path";
import { heroImg } from "./assets";
import { localHeroes } from "./dota-constants";
import type { DraftHero } from "@/components/pouf/draft";

const VIDEO_DIR = "/assets/hero-renders";

/** Слаги с роликом. Манифеста нет (ролики ещё не качали) — пусто, и весь борд едет на PNG. */
function videoSlugs(): Set<string> {
  try {
    const file = path.join(process.cwd(), "public", VIDEO_DIR, "manifest.json");
    const raw = JSON.parse(readFileSync(file, "utf8")) as { slugs?: string[] };
    return new Set(raw.slugs ?? []);
  } catch {
    return new Set();
  }
}

/**
 * Все герои по алфавиту. Считается на каждое чтение, а не кешируется в модуле: справочник
 * локальный и дешёвый, а вот скачанные ролики появляются в обход процесса — запустил скрипт,
 * и они обязаны быть на борде без перезапуска сервера.
 */
export function draftHeroes(): DraftHero[] {
  const videos = videoSlugs();
  return localHeroes()
    .map((h) => {
      const slug = h.name.replace(/^npc_dota_hero_/, "");
      return {
        id: h.id,
        name: h.localized_name,
        img: heroImg(slug),
        video: videos.has(slug) ? `${VIDEO_DIR}/${slug}.webm` : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
