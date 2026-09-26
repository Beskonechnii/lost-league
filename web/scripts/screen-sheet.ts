import "dotenv/config";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { renderFrames, renderHtmlToPng, type FrameSpec } from "@/lib/render-png";
import { SCREENS, type ScreenSpec } from "./screen-sheet.screens";

// Лист контрольных кадров (ТЗ 46): один PNG со всеми экранами на нужных ширинах и подписями.
// Нужен, чтобы вёрстку правили пачкой — Стас смотрит один лист и пишет список замечаний сразу по
// всему, вместо двадцати кругов «правка → сборка → превью» на один экран (PROCESS-REVIEW §4).
//
// Запуск (dev-сервер поднимается ОТДЕЛЬНО, скрипт его не трогает — два dev-сервера в одной папке
// Next 16 не разрешает):
//   cd web && npm run dev        # в другом окне, порт 3000
//   npx tsx scripts/screen-sheet.ts
//   npx tsx scripts/screen-sheet.ts --only=home,admin
//   npx tsx scripts/screen-sheet.ts --base=http://localhost:3002
//
// Список экранов — в `screen-sheet.screens.ts`, логику скрипта для нового экрана править не надо.
// Лист кладётся в `web/.sheets/` (в .gitignore): это вывод, а не ассет, и по HTTP он не раздаётся.

const OUT_DIR = join(process.cwd(), ".sheets");
const OUT_FILE = join(OUT_DIR, "screen-sheet.png");
/** Предел ширины листа: кадры переносятся на новую строку, не вытягиваясь в одну простыню. */
const SHEET_WIDTH = 3100;
/** Предел высоты кадра: длинная страница на 390px иначе даёт полотно в полтора десятка тысяч точек. */
const MAX_FRAME_HEIGHT = 4000;

const arg = (name: string): string | undefined => {
  const pref = `--${name}=`;
  return process.argv.find((a) => a.startsWith(pref))?.slice(pref.length);
};

/** Ширина/высота PNG из заголовка IHDR — нужны для подписи и раскладки, без декодирования картинки. */
const pngSize = (png: Buffer) => ({ w: png.readUInt32BE(16), h: png.readUInt32BE(20) });

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function main() {
  const base = (arg("base") ?? "http://localhost:3000").replace(/\/$/, "");
  if (base.includes("127.0.0.1")) {
    // На 127.0.0.1 Next 16 блокирует dev-ресурсы: гидрация не проходит, и кадр соврёт «кнопки не
    // работают». Проверяем только через localhost.
    console.error("Базовый адрес — только localhost, не 127.0.0.1 (иначе кадр снимется без гидрации).");
    process.exit(1);
  }

  const only = arg("only")?.split(",").map((s) => s.trim()).filter(Boolean);
  if (only) {
    const unknown = only.filter((n) => !SCREENS.some((s) => s.name === n));
    if (unknown.length) {
      console.error(`Нет таких экранов: ${unknown.join(", ")}. Есть: ${SCREENS.map((s) => s.name).join(", ")}`);
      process.exit(1);
    }
  }
  const chosen = only ? SCREENS.filter((s) => only.includes(s.name)) : SCREENS;

  // Сервер поднимает человек — проверяем, что он жив, до запуска браузера: иначе Playwright
  // отвалится таймаутом со стеком вместо внятной подсказки.
  try {
    const r = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(String(r.status));
  } catch {
    console.error(`Dev-сервер не отвечает на ${base}/api/health — подними его: cd web && npm run dev (порт 3000).`);
    process.exit(1);
  }

  const devLogin = (process.env.DEV_LOGIN_EMAIL ?? "").trim();
  const skipped: string[] = [];

  const plan: { screen: ScreenSpec; width: number; spec: FrameSpec }[] = [];
  for (const screen of chosen) {
    if (screen.auth && !devLogin) {
      skipped.push(
        `${screen.name} (${screen.path}): нужен вход, а DEV_LOGIN_EMAIL пуст — кадр не снят. ` +
          "Впиши почту аккаунта в web/.env и перезапусти dev-сервер.",
      );
      continue;
    }
    for (const width of screen.widths) {
      plan.push({
        screen,
        width,
        spec: {
          url: `${base}${screen.path}`,
          width,
          height: screen.height ?? 900,
          fullPage: screen.fullPage ?? true,
          maxHeight: screen.maxHeight ?? MAX_FRAME_HEIGHT,
          scale: 1, // кадр 1:1 к точкам вьюпорта: лист и так весит мегабайты, ретина ему не нужна
          timeoutMs: 30000,
        },
      });
    }
  }
  if (!plan.length) {
    console.error("Снимать нечего: все выбранные экраны отсеяны. Смотри строки выше.");
    skipped.forEach((s) => console.log(`пропущен ${s}`));
    process.exit(1);
  }

  console.log(`Снимаю ${plan.length} кадр(ов) с ${base}…`);
  const bySpec = new Map(plan.map((p) => [p.spec, p]));
  const frames = await renderFrames(
    plan.map((p) => p.spec),
    (spec, reason) => skipped.push(`${bySpec.get(spec)!.screen.name} (${spec.url}, ${spec.width}px): ${reason}`),
  );

  const good = frames.filter(({ spec, finalUrl, status }) => {
    const { screen, width } = bySpec.get(spec)!;
    // Битый адрес в конфиге (устаревший слаг, удалённый id) отдаёт 404 — это не кадр, а ошибка:
    // страница «не найдено» в листе выглядела бы как настоящий экран.
    if (status !== null && status >= 400) {
      skipped.push(`${screen.name} (${screen.path}, ${width}px): HTTP ${status} — адрес в конфиге не открывается`);
      return false;
    }
    // Сессия dev-входа могла не выдаться (не та почта, нет аккаунта) — тогда сервер уводит на
    // /login. Такой кадр не выдаём за готовый: молчаливая форма входа в листе хуже пропуска.
    if (screen.auth && /\/login(\?|$|\/)/.test(finalUrl)) {
      skipped.push(`${screen.name} (${screen.path}, ${width}px): увело на вход (${finalUrl}) — проверь DEV_LOGIN_EMAIL`);
      return false;
    }
    console.log(`  ✓ ${screen.name} ${screen.path} ${width}px`);
    return true;
  });

  skipped.forEach((s) => console.log(`  — пропущен ${s}`));
  if (!good.length) {
    console.error("Ни одного кадра не снято — лист не собран.");
    process.exit(1);
  }

  // Кадры уходят во временную папку ОС, а не в папку вывода: в `.sheets/` остаётся только лист
  // (условие «второго файла и промежуточного мусора не появляется»), и html не тащит base64 на
  // десятки мегабайт в память браузера.
  const tmp = mkdtempSync(join(tmpdir(), "lost-sheet-"));
  try {
    const cards = good.map(({ spec, png }, i) => {
      const { screen, width } = bySpec.get(spec)!;
      const file = join(tmp, `${String(i).padStart(2, "0")}-${screen.name}-${width}.png`);
      writeFileSync(file, png);
      const { w, h } = pngSize(png);
      const cut = screen.fullPage !== false && h >= (screen.maxHeight ?? MAX_FRAME_HEIGHT) ? " · обрезан по высоте" : "";
      return `<figure style="width:${w}px">
        <img src="${pathToFileURL(file).href}" width="${w}" height="${h}" alt="">
        <figcaption><b>${esc(screen.name)}</b> · ${esc(screen.path)} · ${width}px${cut}</figcaption>
      </figure>`;
    });

    const stamp = new Date().toLocaleString("ru-RU");
    const html = `<!doctype html><html lang="ru"><meta charset="utf-8"><style>
      body{margin:0;padding:36px;background:#e7e1d8;
        font:700 14px/1.35 -apple-system,"Segoe UI",Roboto,sans-serif;color:#241f1a}
      h1{margin:0 0 6px;font-size:22px}
      .sub{margin:0 0 26px;font-weight:600;color:#6b6157}
      .sheet{display:flex;flex-wrap:wrap;gap:30px;align-items:flex-start;width:${SHEET_WIDTH}px}
      figure{margin:0}
      img{display:block;background:#fff;border:1px solid #bdb2a3;box-shadow:0 2px 8px rgba(0,0,0,.12)}
      figcaption{padding-top:9px;font-size:14px;color:#3a332c}
      .skip{margin:28px 0 0;padding:14px 16px;background:#f7e9e4;border:1px solid #d9b6a8;
        max-width:${SHEET_WIDTH}px;font-weight:600;white-space:pre-line}
    </style>
    <h1>Лист контрольных кадров LOST</h1>
    <p class="sub">${esc(base)} · ${stamp} · кадров: ${good.length}${only ? ` · --only=${esc(only.join(","))}` : ""}</p>
    <div class="sheet">${cards.join("")}</div>
    ${skipped.length ? `<p class="skip">Не сняты:\n${esc(skipped.join("\n"))}</p>` : ""}
    </html>`;

    mkdirSync(OUT_DIR, { recursive: true });
    const sheet = await renderHtmlToPng(html, { width: SHEET_WIDTH + 72, scale: 1 });
    writeFileSync(OUT_FILE, sheet);
    console.log(`Лист собран (${(sheet.length / 1024 / 1024).toFixed(1)} МБ):`);
    console.log(OUT_FILE);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
