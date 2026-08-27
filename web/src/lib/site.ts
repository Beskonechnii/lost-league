// Адрес сайта для ссылок, которые уходят наружу — в телеграм-бота и в письма, которых пока нет.
//
// Отдельным модулем, а не в `profiles.ts` (где живут ссылки на профили игроков): тот чистый и его
// тянут клиентские компоненты, а `process.env.BASE_URL` в браузере пустой — там такая функция молча
// вернула бы localhost. Здесь она только серверная, и ошибиться негде.
//
// **Почему не один только `BASE_URL`.** Ссылку из бота открывают в телеграме, а `localhost` там не
// адрес: клиент показывает такую ссылку простым текстом, и «Открыть сборку состава» перестаёт
// нажиматься. Постоянного адреса у проекта пока нет (quick tunnel выдаёт новый при каждом запуске,
// см. скилл `serve` и `DEPLOY.md`), поэтому держать его в `.env` значит править файл и перезапускать
// бота после каждого туннеля. Живой адрес уже пишет сам `serve` — оттуда его и берём.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Адрес поднятого туннеля: пишет `serve.sh`, стирает `stop.sh`. Путь относительно `web/`. */
const TUNNEL_FILE = resolve(process.cwd(), ".cache/tunnel.url");

// Файл читаем не чаще раза в несколько секунд: `siteUrl()` зовут на каждое сообщение бота, а
// туннель за время одного диалога не меняется. Отсутствие файла — обычное состояние (туннеля нет),
// поэтому промах кешируем так же, как попадание.
const TTL_MS = 5_000;
let cache: { checked: number; url: string | null } = { checked: 0, url: null };

function tunnelUrl(): string | null {
  const now = Date.now();
  if (cache.checked && now - cache.checked < TTL_MS) return cache.url;

  let url: string | null = null;
  try {
    const raw = readFileSync(TUNNEL_FILE, "utf8").trim();
    if (/^https?:\/\/\S+$/.test(raw)) url = raw.replace(/\/+$/, "");
  } catch {
    // туннель не поднят — это не ошибка, просто адреса нет
  }
  cache = { checked: now, url };
  return url;
}

/**
 * Адрес сайта без хвостового слэша. Порядок: `BASE_URL` (боевой адрес, задан — значит решение
 * принято) → адрес живого туннеля → localhost, на котором крутится `npm run dev`.
 */
export const siteUrl = (): string => {
  const base = (process.env.BASE_URL ?? "").trim();
  if (base) return base.replace(/\/+$/, "");
  return tunnelUrl() ?? "http://localhost:3000";
};

/**
 * Уйдёт ли ссылка наружу рабочей. Телеграму localhost не адрес: ссылку он покажет текстом, и
 * человек решит, что бот сломался. Бот на это отвечает подсказкой, а не молча отдаёт нерабочее.
 */
export const siteIsLocal = (): boolean => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(siteUrl());
