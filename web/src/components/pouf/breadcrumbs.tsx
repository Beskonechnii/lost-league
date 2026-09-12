import Link from "next/link";

// Крошки — ответ на вопрос «где я», а не «как уйти» (Кит, `parts/Breadcrumbs.html`). Жили по месту
// в `app/_components/`, переехали в Кит без правки вида: разметка и так была с листа.
//
// Пришли на смену кнопке «Назад»: та не давала
// контекста, дублировала браузер и на прямой ссылке уводила не туда, откуда пришли, а на фолбэк.
//
// Правила показа — UI-GUIDELINES §3, коротко:
//   · нужны там, где путь длиннее двух шагов и его не видно из строки контекста турнира;
//   · обязательны на карточках (команда, игрок, встреча) — у них своей навигации нет;
//   · последняя ступень (текущая страница) не рисуется: её роль исполняет H1 под крошками.

export type Crumb = { href: string; label: string };

export function Breadcrumbs({ items, className = "" }: { items: Crumb[]; className?: string }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Хлебные крошки" className={`font-pouf text-xs font-bold ${className}`}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((c, i) => (
          <li key={c.href} className="flex items-center gap-1.5">
            {i > 0 && (
              <span aria-hidden className="text-ink-subtle">
                /
              </span>
            )}
            <Link
              href={c.href}
              className="rounded-control text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
            >
              {c.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
