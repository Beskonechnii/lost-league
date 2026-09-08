import Link from "next/link";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { EmptyState } from "@/components/pouf/feedback";
import { buttonClasses } from "@/components/pouf/Button";

// Экран «страницы нет» и «страница упала». Один вид на оба случая: разговор один и тот же —
// что случилось, куда идти дальше. До этого своих экранов не было вовсе, и битый адрес отдавал
// системную страницу Next: чёрный фон, английский текст — поверх наполовину отрисованной светлой
// колонки. Для сайта на светлой бумаге это выглядит как поломка самого сайта.
//
// Ссылки внизу — не «назад», а соседи по верхнему уровню (UI-GUIDELINES §3): с несуществующего
// адреса возвращаться некуда, а идти есть куда.

export function StubPage({
  icon = "search",
  title,
  children,
  action,
}: {
  icon?: "search" | "warn";
  title: string;
  children: React.ReactNode;
  /** Кнопка действия — у ошибки это «Попробовать снова», у 404 её нет. */
  action?: React.ReactNode;
}) {
  return (
    <main className={`mx-auto flex w-full ${SITE_MAX_W} flex-1 flex-col items-center justify-center px-4 py-16 md:px-6`}>
      <EmptyState icon={icon} title={title}>
        {children}
      </EmptyState>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2 font-pouf">
        {action}
        <Link href="/" className={buttonClasses({ size: "sm" })}>
          На главную
        </Link>
        <Link href="/tournaments" className={buttonClasses({ size: "sm", variant: "quiet" })}>
          Турниры
        </Link>
        <Link href="/roster" className={buttonClasses({ size: "sm", variant: "quiet" })}>
          Ростер
        </Link>
      </div>
    </main>
  );
}

/** Текст 404 — один на все места, где его показываем (корень и обе группы маршрутов). */
export function NotFoundView() {
  return (
    <StubPage title="Такой страницы нет">
      Адрес набран с опечаткой или раздел переехал. Турниры, составы и карточки команд на месте —
      начните с главной или найдите нужное поиском в навигации.
    </StubPage>
  );
}
