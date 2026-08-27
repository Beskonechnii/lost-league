import Link from "next/link";
import { notFound } from "next/navigation";
import { listResponses, parseOptions, quizBySlug, responsesTable } from "@/lib/quizzes";
import { denyUnlessPermission } from "../../../_components/permission-gate";
import { READ_MAX_W } from "@/app/_components/ui";
import { QuizSettings } from "./_components/quiz-settings";
import { QuestionList } from "./_components/question-list";
import { Responses } from "./_components/responses";

export const dynamic = "force-dynamic";

// Одна анкета: настройки, вопросы, ответы. Три блока на странице, а не три вкладки — оператор
// правит вопрос и тут же смотрит, что отвечают.

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const quiz = await quizBySlug((await params).slug);
  return { title: quiz?.title ?? "Анкета" };
}

export default async function QuizPage({ params }: { params: Promise<{ slug: string }> }) {
  const denied = await denyUnlessPermission("quizzes", "Анкеты");
  if (denied) return denied;

  const quiz = await quizBySlug((await params).slug);
  if (!quiz) notFound();

  const responses = await listResponses(quiz.id);
  const table = responsesTable(quiz.questions, responses);

  return (
    <main className={`mx-auto w-full ${READ_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <Link href="/admin/quizzes" className="text-xs text-ink-subtle hover:text-ink">
        ← Все анкеты
      </Link>
      <h1 className="mt-2 text-xl font-bold tracking-tight">{quiz.title}</h1>

      <QuizSettings quiz={{ ...quiz, closeAt: quiz.closeAt?.toISOString() ?? null }} />

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-ink-subtle">Вопросы</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-muted">
        Бот задаёт их по порядку. Варианты ответа — кнопками; без вариантов человек отвечает текстом.
      </p>
      <QuestionList
        slug={quiz.slug}
        quizId={quiz.id}
        questions={quiz.questions.map((q) => ({ ...q, options: parseOptions(q.options) }))}
      />

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-ink-subtle">
        Ответы {responses.length > 0 && <span className="text-ink-muted">· {responses.length}</span>}
      </h2>
      <Responses slug={quiz.slug} table={table} />
    </main>
  );
}
