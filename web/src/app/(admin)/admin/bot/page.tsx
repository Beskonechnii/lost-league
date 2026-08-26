import { loadQuizForEditor } from "@/lib/quiz-config";
import { denyUnlessPermission } from "../../_components/permission-gate";
import { READ_MAX_W } from "@/app/_components/ui";
import { BotAdmin } from "./_components/bot-admin";

export const metadata = { title: "Бот заявок" };
export const dynamic = "force-dynamic";

// Вопросы телеграм-бота. Тексты шагов правятся здесь, а не в коде: формулировка — работа
// организатора, и держать её в исходниках значит ходить за правкой запятой к разработчику.
// Что где хранится — `src/lib/quiz-config.ts` (дефолт в коде, отличия в БД).

export default async function BotPage() {
  const denied = await denyUnlessPermission("tournaments.edit", "Бот заявок");
  if (denied) return denied;

  const quiz = await loadQuizForEditor();
  return (
    <main className={`mx-auto w-full ${READ_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <BotAdmin quiz={quiz} />
    </main>
  );
}
