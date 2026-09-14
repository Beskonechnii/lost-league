// Синк медалей рангов Dota из OpenDota в public/uploads/ranks.
// Имена файлов сохраняются исходными (rank_icon_<N>.png, rank_star_<N>.png) — имя файла и есть
// слаг, таблицы соответствий нет ни здесь, ни в рантайме (см. rankMedalUrls в src/lib/assets.ts).
//
// Запуск (из web/):  npx tsx scripts/sync-rank-icons.ts
//   --force   перекачать уже существующие файлы
//
// Отдельно от sync-assets.ts, а не флагом в нём: там источник — константы OpenDota API и Steam CDN,
// здесь — шестнадцать фиксированных имён. Общего кода на два случая меньше, чем ветвлений.
// Кладём в uploads/, а не в assets/: в assets/ пишет sync-assets.ts, и смешивать два источника
// в одной папке — путь к тому, что один скрипт затрёт чужое.

import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://www.opendota.com/assets/images/dota2/rank_icons";

const here = path.dirname(fileURLToPath(import.meta.url)); // web/scripts
const ranksDir = path.resolve(here, "../public/uploads/ranks");

const force = process.argv.slice(2).includes("--force");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 0 — «без калибровки», 1 Рекрут … 7 Божество, 8 Иммортал; звёзды 1–7.
// Рантайм не спрашивает ни icon_0, ни star_6/7 (rankParts() режет), но набор качаем полный:
// выборочный однажды придётся достукивать руками, а 56 КБ мёртвого веса того не стоят.
const files = [
  ...Array.from({ length: 9 }, (_, i) => `rank_icon_${i}.png`),
  ...Array.from({ length: 7 }, (_, i) => `rank_star_${i + 1}.png`),
];

// missing = 404 (у источника такого файла нет — не сбой); fail = сеть/5xx, влияет на exit-код.
async function download(name: string, tries = 3): Promise<"ok" | "skip" | "missing" | "fail"> {
  const dest = path.join(ranksDir, name);
  if (!force && existsSync(dest)) return "skip";
  for (let t = 1; t <= tries; t++) {
    try {
      const res = await fetch(`${BASE}/${name}`);
      if (res.status === 404) return "missing";
      if (!res.ok) throw new Error(String(res.status));
      await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
      return "ok";
    } catch (e) {
      if (t === tries) {
        console.warn(`  ✗ ${name} (${e})`);
        return "fail";
      }
      await sleep(300 * t);
    }
  }
  return "fail";
}

// Простой пул воркеров — не заваливаем источник.
async function pool<T>(items: T[], n: number, worker: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) await worker(items[i++]);
    }),
  );
}

async function main() {
  console.log(`Синк медалей рангов${force ? " (force)" : ""}: ${files.length} файлов → ${ranksDir}\n`);
  await fs.mkdir(ranksDir, { recursive: true });

  const stat = { ok: 0, skip: 0, missing: 0, fail: 0 };
  await pool(files, 8, async (name) => {
    const r = await download(name);
    stat[r]++;
    if (r === "skip") console.log(`  · ${name} уже есть`);
    if (r === "missing") console.warn(`  ? ${name} нет у источника`);
  });

  console.log(
    `\nГотово: ${stat.ok} скачано, ${stat.skip} пропущено, ${stat.missing} нет у источника, ${stat.fail} ошибок.`,
  );
  if (stat.fail) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
