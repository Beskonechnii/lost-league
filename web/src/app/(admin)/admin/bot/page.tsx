import Link from "next/link";
import { loadQuizForEditor } from "@/lib/quiz-config";
import { loadBotSettingsForEditor } from "@/lib/bot-settings";
import { denyUnlessPermission } from "../../_components/permission-gate";
import { READ_MAX_W } from "@/app/_components/ui";
import { BotAdmin } from "./_components/bot-admin";
import { BotSettingsAdmin } from "./_components/bot-settings-admin";

export const metadata = { title: "Телеграм-бот" };
export const dynamic = "force-dynamic";

// Что бот говорит и по каким таймингам. Тексты шагов и настройки флоу правятся здесь, а не в коде:
// формулировка и «за сколько напоминать» — работа организатора, и держать их в исходниках значит
// ходить за правкой запятой к разработчику.
//
// Две вкладки, потому что это две разные работы: «Вопросы» — приём заявки (`quiz-config.ts`),
// «Настройки» — напоминания и уведомления о встречах (`bot-settings.ts`). У обеих один уклад:
// дефолт в коде, в БД только отличия.

const TABS = [
  { key: "questions", label: "Вопросы" },
  { key: "settings", label: "Настройки" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function BotPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const denied = await denyUnlessPermission("tournaments.edit", "Телеграм-бот");
  if (denied) return denied;

  const tab: TabKey = (await searchParams).tab === "settings" ? "settings" : "questions";
  const [quiz, settings] = await Promise.all([
    tab === "questions" ? loadQuizForEditor() : null,
    tab === "settings" ? loadBotSettingsForEditor() : null,
  ]);

  return (
    <main className={`mx-auto w-full ${READ_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <h1 className="text-xl font-bold tracking-tight">Телеграм-бот</h1>

      {/* Разрез живёт в query, как и везде на сайте: ссылку на нужную вкладку можно кинуть в чат. */}
      <div className="mt-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "questions" ? "/admin/bot" : `/admin/bot?tab=${t.key}`}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              tab === t.key ? "border-accent bg-surface-2 text-ink" : "border-hairline bg-surface-1 text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {quiz ? <BotAdmin quiz={quiz} /> : settings ? <BotSettingsAdmin settings={settings} /> : null}
    </main>
  );
}
