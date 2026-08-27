import "dotenv/config";
import { botConfigured, getUpdates, sendTo, tgCall, type Update } from "@/lib/telegram";
import { replyTo } from "@/lib/tg-quiz";

// Телеграм-бот лиги: крутит квиз заявки команды (`src/lib/tg-quiz.ts`). Запускается руками и живёт,
// пока открыт приём заявок:
//
//   cd web && npm run bot          — в этом окне, видно лог
//   cd web && npm run bot:up       — фоном, не занимая терминал (лог: npm run bot:log, стоп: npm run bot:down)
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
//
// Правка **вопросов** в /admin/bot доезжает без перезапуска (конфигурация читается на каждое
// сообщение), а правка **кода** — только перезапуском: `npm run bot:watch` делает это сам.

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
  // Кроме текста принимаем картинку: фото профиля человек шлёт именно ей (src/lib/tg-profile.ts).
  // Всё остальное (стикеры, голосовые, документы) молча пропускаем — ответить на них нечем.
  const photo = message?.photo?.length ? message.photo[message.photo.length - 1].file_id : null;
  if (!message || (!message.text && !photo)) return;
  const chatId = String(message.chat.id);
  try {
    await replyTo(
      chatId,
      // У фото текста нет — подпись к картинке нам не нужна, шаг ждёт саму картинку.
      message.text ?? "",
      message.from?.username,
      message.from?.id ? String(message.from.id) : null,
      photo,
    );
  } catch (e) {
    console.error(`Чат ${chatId}:`, e);
    // Человеку тоже говорим — иначе бот молча «завис» посреди диалога.
    await sendTo(chatId, "Что-то сломалось на нашей стороне. Попробуйте ещё раз или начните заново — /start.").catch(
      () => {},
    );
  }
}

async function main() {
  console.log(`Бот ${await whoami()} слушает. Остановить — Ctrl+C, а если запущен фоном — npm run bot:down.`);

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

  let conflicts = 0;
  for (;;) {
    let updates: Update[];
    try {
      updates = await getUpdates(offset);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // 409 от Telegram значит «за апдейтами уже кто-то ходит»: два бота на одном токене отбирают
      // сообщения друг у друга, и диалоги рвутся посреди состава. Одиночный конфликт — это свой же
      // перезапуск под `bot:watch`, он проходит сам; упорный — второе запущенное окно.
      if (message.includes("409") || message.toLowerCase().includes("conflict")) {
        if (++conflicts >= 5) {
          console.error("\nБот уже запущен где-то ещё (Telegram отдаёт Conflict). Закройте второе окно и запустите снова.");
          process.exit(1);
        }
        await new Promise((r) => setTimeout(r, 2_000));
        continue;
      }
      // Сеть отвалилась или Telegram ответил 5xx — ждём и пробуем снова, а не выходим: бот должен
      // пережить смену wifi, не требуя перезапуска руками.
      console.error("Не получил апдейты:", message);
      await new Promise((r) => setTimeout(r, 5_000));
      continue;
    }
    conflicts = 0;

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
