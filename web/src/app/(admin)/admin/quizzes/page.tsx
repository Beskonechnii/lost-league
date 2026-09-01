import Link from "next/link";
import { listQuizzes, quizOpen } from "@/lib/quizzes";
import { denyUnlessPermission } from "../../_components/permission-gate";
import { READ_MAX_W } from "@/components/pouf/blocks";
import { NewQuizForm } from "./_components/new-quiz-form";

export const metadata = { title: "Анкеты" };
export const dynamic = "force-dynamic";

// Список анкет — вход в раздел. Устройство и почему отдельно от заявки команды — `src/lib/quizzes.ts`.

const STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Черновик", tone: "border-hairline text-ink-subtle" },
  open: { label: "Открыта", tone: "border-emerald-200 text-emerald-700" },
  closed: { label: "Закрыта", tone: "border-hairline text-ink-muted" },
};

export default async function QuizzesPage() {
  const denied = await denyUnlessPermission("quizzes", "Анкеты");
  if (denied) return denied;

  const quizzes = await listQuizzes();

  return (
    <main className={`mx-auto w-full ${READ_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <h1 className="text-xl font-bold tracking-tight">Анкеты</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Опросы и записи на ивенты, которые бот собирает в телеграме: запись на шоуматч, заявка кастера,
        любой вопрос к аудитории. Заявка команды живёт отдельно — у неё свои проверки и очередь
        модерации.
      </p>

      <NewQuizForm />

      {quizzes.length === 0 ? (
        <p className="mt-6 rounded-md border border-hairline bg-surface-1 px-3 py-6 text-center text-sm text-ink-subtle">
          Анкет пока нет.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {quizzes.map((quiz) => {
            const status = STATUS[quiz.status] ?? { label: quiz.status, tone: "border-hairline text-ink-subtle" };
            // Срок мог пройти, а статус остаться «открыта» — показываем то, что видит человек в боте.
            const live = quizOpen(quiz);
            return (
              <li key={quiz.id} className="rounded-lg border border-hairline bg-surface-1 p-4">
                <Link href={`/admin/quizzes/${quiz.slug}`} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`rounded-md border px-2 py-0.5 text-xs ${status.tone}`}>{status.label}</span>
                  <span className="text-sm font-semibold text-ink hover:text-accent-bright">{quiz.title}</span>
                  {quiz.status === "open" && !live && (
                    <span className="text-xs text-amber-700">срок прошёл — бот не предлагает</span>
                  )}
                  <span className="text-xs text-ink-subtle">
                    вопросов: {quiz.questions.length} · ответов: {quiz.responses.length}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
