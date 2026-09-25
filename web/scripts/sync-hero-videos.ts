// Закачка анимированных рендеров героев (webm) Valve в public/assets/hero-renders (ТЗ 42г §6–7).
//
// Источник — открытые рендеры dota2.com: cdn.cloudflare.steamstatic.com/apps/dota2/videos/
// dota_react/heroes/renders/<slug>.webm. Слаг тот же, что у PNG: имя файла связывает портрет,
// ролик и пул (CLAUDE.md §«Конвенции»).
//
// Запуск (из web/):  npx tsx scripts/sync-hero-videos.ts
//   --check          ничего не качать: только HEAD по всем слагам и суммарный вес
//   --force          перекачать уже лежащие файлы
//   --only=a,b,c     ограничить набор слагами (прогон вёрстки на трёх героях)
//
// Идемпотентно по образцу `sync-assets.ts`: по умолчанию пропускает уже скачанное, поэтому
// повторный запуск на репозитории с ассетами в git не качает ничего (ТЗ 42г §7).
//
// Ролик есть не у каждого героя, и это НЕ ошибка: кнопка пула показывает такому герою PNG.
// Список реально лежащих файлов пишется в hero-renders/manifest.json — по нему страница решает,
// кому вообще отдавать `<video>`, не трогая диск на каждый рендер.

import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CDN = "https://cdn.cloudflare.steamstatic.com/apps/dota2/videos/dota_react/heroes/renders";

const here = path.dirname(fileURLToPath(import.meta.url)); // web/scripts
const assetsDir = path.resolve(here, "../public/assets");
const videoDir = path.join(assetsDir, "hero-renders");

const args = process.argv.slice(2);
const has = (flag: string) => args.includes(flag);
const check = has("--check");
const force = has("--force");
const only = args
  .find((a) => a.startsWith("--only="))
  ?.slice("--only=".length)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const url = (slug: string) => `${CDN}/${slug}.webm`;
const mb = (bytes: number) => `${(bytes / 1048576).toFixed(1)} МБ`;

/** Слаги героев — из манифеста PNG: один список на обе закачки, второго источника имён нет. */
async function heroSlugs(): Promise<string[]> {
  const raw = await fs.readFile(path.join(assetsDir, "manifest.json"), "utf8");
  const slugs = (JSON.parse(raw) as { slugs?: { heroes?: string[] } }).slugs?.heroes ?? [];
  if (slugs.length === 0) throw new Error("public/assets/manifest.json без героев — сперва scripts/sync-assets.ts");
  return only ? slugs.filter((s) => only.includes(s)) : slugs;
}

// Простой пул воркеров — не заваливаем CDN (тот же приём, что в sync-assets.ts).
async function pool<T>(items: T[], n: number, worker: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) await worker(items[i++]);
    }),
  );
}

/** Сколько весит ролик на CDN. null — ролика нет (404), это норма, а не сбой. */
async function weigh(slug: string): Promise<number | null> {
  const res = await fetch(url(slug), { method: "HEAD" });
  if (!res.ok) return null;
  return Number(res.headers.get("content-length") ?? 0);
}

async function download(slug: string, tries = 3): Promise<"ok" | "skip" | "missing" | "fail"> {
  const dest = path.join(videoDir, `${slug}.webm`);
  if (!force && existsSync(dest)) return "skip";
  for (let t = 1; t <= tries; t++) {
    try {
      const res = await fetch(url(slug));
      if (res.status === 404) return "missing";
      if (!res.ok) throw new Error(String(res.status));
      await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
      return "ok";
    } catch (e) {
      if (t === tries) {
        console.warn(`  ✗ ${slug}.webm (${e})`);
        return "fail";
      }
      await sleep(300 * t);
    }
  }
  return "fail";
}

/** Манифест — по тому, что РЕАЛЬНО лежит на диске, а не по тому, что мы собирались скачать. */
async function writeManifest() {
  const files = existsSync(videoDir) ? (await fs.readdir(videoDir)).filter((f) => f.endsWith(".webm")) : [];
  let bytes = 0;
  for (const f of files) bytes += (await fs.stat(path.join(videoDir, f))).size;
  const slugs = files.map((f) => f.replace(/\.webm$/, "")).sort();
  await fs.mkdir(videoDir, { recursive: true });
  await fs.writeFile(
    path.join(videoDir, "manifest.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), source: "Valve dota_react hero renders", bytes, slugs }, null, 2),
  );
  return { count: slugs.length, bytes };
}

async function main() {
  const slugs = await heroSlugs();

  if (check) {
    console.log(`Замер: ${slugs.length} героев, HEAD по ${CDN}\n`);
    let total = 0;
    const missing: string[] = [];
    await pool(slugs, 10, async (s) => {
      const size = await weigh(s);
      if (size === null) missing.push(s);
      else total += size;
    });
    console.log(`Есть ролик: ${slugs.length - missing.length} из ${slugs.length}, суммарно ${mb(total)}`);
    console.log(`Средний: ${mb(total / Math.max(1, slugs.length - missing.length))}`);
    if (missing.length) console.log(`Без ролика (${missing.length}): ${missing.join(", ")}`);
    return;
  }

  await fs.mkdir(videoDir, { recursive: true });
  console.log(`Качаю рендеры: ${slugs.length} героев${force ? " (force)" : ""} → ${videoDir}\n`);

  const stat = { ok: 0, skip: 0, missing: 0, fail: 0 };
  let done = 0;
  await pool(slugs, 4, async (s) => {
    stat[await download(s)]++;
    if (++done % 20 === 0) console.log(`  …${done}/${slugs.length}`);
  });

  const m = await writeManifest();
  console.log(
    `\nГотово: ${stat.ok} скачано, ${stat.skip} пропущено, ${stat.missing} без ролика, ${stat.fail} ошибок.`,
  );
  console.log(`На диске: ${m.count} роликов, ${mb(m.bytes)} · манифест hero-renders/manifest.json`);
  if (stat.fail) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
