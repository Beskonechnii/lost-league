import Link from "next/link";
import { loadBotSettingsForEditor } from "@/lib/bot-settings";
import { telegramConfigured } from "@/lib/telegram";
import { denyUnlessPermission } from "../../_components/permission-gate";
import { READ_MAX_W } from "@/components/pouf/blocks";
import { BotSettingsAdmin } from "./_components/bot-settings-admin";

export const metadata = { title: "Телеграм-бот" };
export const dynamic = "force-dynamic";

// По каким таймингам бот пишет сам: напоминания о встречах и утренний дайджест (`bot-settings.ts`).
// Дефолт в коде, в БД только отличия оператора.
//
// **Вкладки «Вопросы» здесь больше нет** (`BOT-FLOW-PLAN.md`, Э6). Формулировки шагов диалога были
// вторым реестром текстов рядом с графом, и одно и то же приходилось искать в двух местах; теперь
// текст — свойство ноды и правится в «Флоу». Настройки остались: у них нет входящего сообщения и
// потому нет ноды — это исходящий поток, а не разговор.

export default async function BotPage() {
  const denied = await denyUnlessPermission("tournaments.edit", "Телеграм-бот");
  if (denied) return denied;

  const settings = await loadBotSettingsForEditor();

  return (
    <main className={`mx-auto w-full ${READ_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <h1 className="text-xl font-bold tracking-tight">Телеграм-бот</h1>

      {/* Флоу — соседний маршрут, а не вкладка: канвасу нужна вся ширина витрины, а здесь колонка
          чтения. Ссылка стоит первой строкой, потому что «что бот говорит» оператор ищет чаще, чем
          «за сколько напоминать». */}
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href="/admin/bot/flow"
          className="rounded-md border border-hairline bg-surface-1 px-3 py-1.5 text-sm text-ink-muted hover:text-ink"
        >
          Флоу: что бот говорит и как ведёт разговор →
        </Link>
      </div>

      <BotSettingsAdmin settings={settings} digestOff={!telegramConfigured()} />
    </main>
  );
}
