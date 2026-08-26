import "dotenv/config";
import { botConfigured, getUpdates, sendTo, tgCall, type Update } from "@/lib/telegram";
import { replyTo } from "@/lib/tg-quiz";

// Телеграм-бот лиги: крутит квиз заявки команды (`src/lib/tg-quiz.ts`). Запускается руками и живёт,
// пока открыт приём заявок:
//
//   cd web && npx tsx scripts/bot.ts
//
// **Long polling, а не вебхук** — бот сам ходит за апдейтами, поэтому публичный адрес не нужен и
// бота можно держать с ноутбука до выката наружу (`DEPLOY.md`). Когда приложение переедет на VPS,
// сюда добавится роут-вебхук: логика квиза от транспорта не зависит.
//
// Требует `TG_BOT_TOKEN` в `web/.env` (токен от @BotFather) и работающую БД: диалоги лежат в
// `BotSession`, готовые заявки — в `TeamApplication` (source = telegram), очередь — /admin/moderation.
//
// Флаги:
//   --once   разобрать то, что накопилось, и выйти (проверка связи и прогонов в разработке).

const once = process.argv.includes("--once");

if (!botConfigured()) {
  console.error("Нет TG_BOT_TOKEN в web/.env — заведи бота у @BotFather и впиши токен.");
  process.exit(1);
}

/** Живы ли мы вообще и под каким именем — первое, что хочется знать при запуске. */
async function whoami(): Promise<string> {
  const me = await tgCall<{ username?: string }>("getMe", {});
  return me.username ? `@${me.username}` : "бот";
}

/**
 * Один апдейт. Ошибку разбора не роняем наружу: упавший на одном сообщении процесс перестаёт
 * отвечать всем остальным, а сама заявка лежит в БД и переживёт перезапуск.
 */
async function handle(update: Update): Promise<void> {
  const message = update.message;
  if (!message?.text) return;
  const chatId = String(message.chat.id);
  try {
    await replyTo(chatId, message.text);
  } catch (e) {
    console.error(`Чат ${chatId}:`, e);
    // Человеку тоже говорим — иначе бот молча «завис» посреди диалога.
    await sendTo(chatId, "Что-то сломалось на нашей стороне. Попробуйте ещё раз или начните заново — /start.").catch(
      () => {},
    );
  }
}

async function main() {
  console.log(`Бот ${await whoami()} слушает. Ctrl+C — остановить.`);

  // Апдейты Telegram хранит сутки и отдаёт, пока их не подтвердили следующим offset'ом. Начинаем с
  // хвоста: накопленное за время простоя разбирать нечего — люди уже ушли, а диалоги их сбиты.
  let offset = 0;
  if (!once) {
    const backlog = await getUpdates(0, 0);
    if (backlog.length) {
      offset = backlog[backlog.length - 1].update_id + 1;
      console.log(`Пропущено накопившихся сообщений: ${backlog.length}`);
    }
  }

  for (;;) {
    let updates: Update[];
    try {
      updates = await getUpdates(offset);
    } catch (e) {
      // Сеть отвалилась или Telegram ответил 5xx — ждём и пробуем снова, а не выходим: бот должен
      // пережить смену wifi, не требуя перезапуска руками.
      console.error("Не получил апдейты:", e instanceof Error ? e.message : e);
      await new Promise((r) => setTimeout(r, 5_000));
      continue;
    }

    for (const update of updates) {
      offset = update.update_id + 1;
      await handle(update);
    }

    if (once) {
      console.log(`Разобрано апдейтов: ${updates.length}`);
      return;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
