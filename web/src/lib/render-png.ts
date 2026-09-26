// Только сервер / скрипт: рендер страницы в PNG через headless-браузер (кирпич C роадмапа).
// Нужен там, где клиентский modern-screenshot не годится — автоматическая выгрузка без окна
// оператора (инфографика матча в ТГ, серверные OG-картинки).
//
// Playwright — devDependency и тянется лениво (import внутри функции): в клиентский бандл и в
// обычный рантайм приложения он не попадает, зовётся только из скриптов/серверных утилит.
// Браузер ставится один раз: `npx playwright install chromium`.

export type RenderOptions = {
  width?: number;
  height?: number;
  /** Снять не всю страницу, а один элемент по CSS-селектору (например «голый» холст рендера). */
  selector?: string;
  /** Множитель плотности пикселей — для чётких картинок под ретину/шеринг. */
  scale?: number;
  /** Сколько ждать сетевого затишья, мс. */
  timeoutMs?: number;
  /** Снять экран целиком до конца прокрутки, а не только первый экран. */
  fullPage?: boolean;
  /** Предел высоты кадра при `fullPage`: длинная таблица иначе даёт полотно на десятки тысяч точек. */
  maxHeight?: number;
};

type Chromium = Awaited<typeof import("playwright")>["chromium"];
type Browser = Awaited<ReturnType<Chromium["launch"]>>;

async function loadChromium(): Promise<Chromium> {
  try {
    return (await import("playwright")).chromium;
  } catch {
    throw new Error("Playwright не установлен. Поставь: npm i -D playwright && npx playwright install chromium");
  }
}

/** Один кадр: открыть страницу, снять PNG, вернуть его вместе с адресом, где браузер в итоге оказался. */
async function shoot(
  browser: Browser,
  url: string,
  opts: RenderOptions,
): Promise<{ png: Buffer; finalUrl: string; status: number | null }> {
  const { width = 1920, height = 1080, selector, scale = 2, timeoutMs = 20000, fullPage, maxHeight = 3200 } = opts;

  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  try {
    const res = await page.goto(url, { waitUntil: "networkidle", timeout: timeoutMs });
    const status = res?.status() ?? null;

    if (selector) {
      const el = await page.waitForSelector(selector, { timeout: timeoutMs });
      if (!el) throw new Error(`Элемент «${selector}» не найден на ${url}`);
      return { png: (await el.screenshot({ type: "png" })) as Buffer, finalUrl: page.url(), status };
    }
    if (fullPage) {
      // Не `fullPage: true` у скриншота, а растянутый вьюпорт: прилипшие шапки и элементы на
      // 100vh на длинном кадре иначе размножаются или обрезаются.
      const doc = await page.evaluate(() => document.documentElement.scrollHeight);
      const tall = Math.min(Math.max(doc, height), maxHeight);
      if (tall !== height) {
        await page.setViewportSize({ width, height: tall });
        await page.waitForTimeout(250); // дать доехать анимациям раскладки после смены вьюпорта
      }
    }
    return { png: (await page.screenshot({ type: "png", fullPage: false })) as Buffer, finalUrl: page.url(), status };
  } finally {
    await page.close();
  }
}

/** Отрисовать URL в PNG и вернуть Buffer. Бросает понятную ошибку, если браузер не установлен. */
export async function renderUrlToPng(url: string, opts: RenderOptions = {}): Promise<Buffer> {
  const browser = await (await loadChromium()).launch({ headless: true });
  try {
    return (await shoot(browser, url, opts)).png;
  } finally {
    await browser.close();
  }
}

export type FrameSpec = RenderOptions & { url: string };
export type FrameResult = { spec: FrameSpec; png: Buffer; finalUrl: string; status: number | null };

/**
 * Пачка кадров за один запуск браузера (лист контрольных кадров — `scripts/screen-sheet.ts`).
 * Сбой одного кадра не рвёт прогон: он уходит в `onFail`, остальные снимаются.
 */
export async function renderFrames(
  frames: FrameSpec[],
  onFail?: (spec: FrameSpec, reason: string) => void,
): Promise<FrameResult[]> {
  const browser = await (await loadChromium()).launch({ headless: true });
  const out: FrameResult[] = [];
  try {
    for (const spec of frames) {
      try {
        out.push({ spec, ...(await shoot(browser, spec.url, spec)) });
      } catch (e) {
        onFail?.(spec, e instanceof Error ? e.message.split("\n")[0] : String(e));
      }
    }
  } finally {
    await browser.close();
  }
  return out;
}

/**
 * Снять PNG со свёрстанной HTML-страницы — так склеивается лист контрольных кадров.
 * Страница кладётся во временный файл и открывается как `file://`: картинки с диска
 * (`<img src="file://…">`) с `setContent` на about:blank браузер не грузит.
 */
export async function renderHtmlToPng(html: string, opts: { width?: number; scale?: number } = {}): Promise<Buffer> {
  const { width = 1600, scale = 1 } = opts;
  const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { pathToFileURL } = await import("node:url");

  const dir = mkdtempSync(join(tmpdir(), "render-html-"));
  const file = join(dir, "page.html");
  writeFileSync(file, html);

  const browser = await (await loadChromium()).launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: scale });
    await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
    return (await page.screenshot({ type: "png", fullPage: true })) as Buffer;
  } finally {
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
  }
}
