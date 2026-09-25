// Справочник героев для борда драфта: портрет и анимированный рендер.
//
// Один список на комнату и на ОБС-вид: картинка в эфире обязана совпадать с той, что видят
// капитаны, а собирать её двумя копиями на двух страницах — верный способ разойтись.
//
// Ролики берём ПРЯМО У VALVE (решение Стаса 25.09.2026, отменяет ТЗ 42г §7): 127 webm весят
// 500 МБ, а весь `public/assets` — 57 МБ, и в git такое не кладётся. Свои файлы — отдельная
// работа в `BACKLOG.md`, скрипт закачки (`scripts/sync-hero-videos.ts`) остаётся под неё.
// Ролик не приехал (нет файла у Valve, нет сети) — на плитке остаётся PNG, и это не ошибка:
// отказ обрабатывает сама плитка (`DraftHeroButton`), а не этот список.

import { heroImg } from "./assets";
import { localHeroes } from "./dota-constants";
import type { DraftHero } from "@/components/pouf/draft";

const CDN = "https://cdn.cloudflare.steamstatic.com/apps/dota2/videos/dota_react/heroes/renders";

/** Все герои по алфавиту. */
export function draftHeroes(): DraftHero[] {
  return localHeroes()
    .map((h) => {
      const slug = h.name.replace(/^npc_dota_hero_/, "");
      return {
        id: h.id,
        name: h.localized_name,
        img: heroImg(slug),
        video: `${CDN}/${slug}.webm`,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
