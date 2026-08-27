// Только сервер / скрипт: Telegram Bot API. Два потребителя:
//   • исходящее — авто-инфографика (render-png.ts → sendPhoto) шлёт в канал `TG_CHAT_ID`;
//   • входящее — квиз заявки команды (src/lib/tg-quiz.ts), его крутит `scripts/bot.ts`.
// Токен и чат берём из окружения — в код/коммит не кладём.
//
// .env:
//   TG_BOT_TOKEN=123456:ABC...   токен бота от @BotFather
//   TG_CHAT_ID=123456789         куда слать инфографику (свой user id, id канала или группы)
//
// `TG_CHAT_ID` нужен только исходящему потоку: квиз отвечает в тот чат, из которого пришло
// сообщение. Токен — это credential: заводит его владелец бота, код лишь читает из .env. Без него
// функции бросают понятную ошибку, а пайплайн инфографики всё равно сохраняет PNG на диск
// (см. send-infographic.ts).

/** Токен бота. Отдельно от чата: входящему потоку чат не нужен. */
function token(): string {
  const value = process.env.TG_BOT_TOKEN?.trim();
  if (!value) throw new Error("Нет TG_BOT_TOKEN в .env — заведи бота у @BotFather и впиши токен.");
  return value;
}

function creds(): { token: string; chatId: string } {
  const chatId = process.env.TG_CHAT_ID?.trim();
  if (!chatId) throw new Error("Нет TG_CHAT_ID в .env — укажи, куда слать (свой user id или id канала).");
  return { token: token(), chatId };
}

/** Есть ли настройки для отправки — чтобы пайплайн решал, слать или только сохранить на диск. */
export const telegramConfigured = (): boolean => !!(process.env.TG_BOT_TOKEN && process.env.TG_CHAT_ID);

/** Заведён ли бот вообще — этого хватает квизу (отвечает он в чат отправителя). */
export const botConfigured = (): boolean => !!process.env.TG_BOT_TOKEN;

/**
 * Вызов метода Bot API. Один вход для всех методов: у Telegram ошибка приезжает не кодом HTTP, а
 * полем `ok: false` в теле — проверять это в каждом вызове по отдельности значит однажды забыть.
 */
export async function tgCall<T>(method: string, body: unknown, timeoutMs = 15_000): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) throw new Error(`Telegram отказал (${method}): ${json.description ?? res.status}`);
  return json.result as T;
}

// ── входящее: long polling ───────────────────────────────────────────────────

/** Апдейт Bot API — берём только то, что нужно квизу: текст сообщения и чат. */
export type Update = {
  update_id: number;
  message?: {
    chat: { id: number };
    text?: string;
    /** `id` — ключ человека (в личке совпадает с `chat.id`, но принадлежит пользователю, а не чату):
     *  по нему регистрация привязывает аккаунт, и он переживает смену хендла. */
    from?: { id?: number; username?: string };
  };
};

/**
 * Забрать апдейты начиная с `offset`. Long polling: запрос висит до `timeout` секунд и возвращается
 * сразу, как появилось сообщение — так бот отвечает мгновенно, не долбя API опросом каждую секунду.
 * HTTP-таймаут берём с запасом над серверным, иначе рвём соединение раньше, чем Telegram ответит.
 */
export const getUpdates = (offset: number, timeout = 25): Promise<Update[]> =>
  tgCall<Update[]>("getUpdates", { offset, timeout, allowed_updates: ["message"] }, (timeout + 10) * 1000);

/** Клавиатура из готовых ответов: варианты кнопками, чтобы капитан не печатал их руками. */
export type Keyboard = string[][] | null;

/** Что бот говорит в ответ на одно сообщение. Живёт здесь, а не в квизе: отвечает не только квиз. */
export type Reply = { text: string; keyboard?: Keyboard };

/**
 * Ответ в конкретный чат. Клавиатуру всегда шлём явно (`remove_keyboard`, когда её нет): Telegram
 * держит последнюю показанную до отмены, и без этого кнопки прошлого шага висят над свободным полем.
 */
export function sendTo(chatId: string | number, text: string, keyboard: Keyboard = null): Promise<unknown> {
  return tgCall("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: keyboard
      ? { keyboard: keyboard.map((row) => row.map((t) => ({ text: t }))), resize_keyboard: true, one_time_keyboard: true }
      : { remove_keyboard: true },
  });
}

// ── исходящее: инфографика в канал ───────────────────────────────────────────

/** Отправить PNG как фото с подписью. Бросает при ошибке сети или Bot API. */
export async function sendPhoto(png: Buffer, caption = ""): Promise<void> {
  const { token, chatId } = creds();
  const form = new FormData();
  form.set("chat_id", chatId);
  if (caption) {
    form.set("caption", caption);
    form.set("parse_mode", "HTML");
  }
  form.set("photo", new Blob([new Uint8Array(png)], { type: "image/png" }), "match.png");

  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: form });
  const json = (await res.json()) as { ok: boolean; description?: string };
  if (!json.ok) throw new Error(`Telegram отказал: ${json.description ?? res.status}`);
}

/** Служебное уведомление в канал из `TG_CHAT_ID` (ответ конкретному человеку — `sendTo`). */
export async function sendMessage(text: string): Promise<void> {
  await sendTo(creds().chatId, text);
}
