import type { ReactNode } from "react";

/* Карточка очереди — артборд Кита из списка служебной части (`RELEASE-PLAN.md` §A):
 * заявка с «принять» и «отклонить с причиной».
 *
 * Один рисунок на все очереди лиги: анкета игрока, привязка к профилю, правка
 * профиля из бота, заявка команды на турнир, пара дублей. К Э9 каждая из них
 * верстала одно и то же руками — `rounded-lg border border-hairline bg-surface-1
 * p-4`, ряд разноцветных плашек сырыми оттенками, решение внизу двумя формами, —
 * и совпадали они не полностью: где-то время отправки прижато вправо, где-то нет,
 * где-то содержание заявки в лунке, где-то просто абзацем.
 *
 * Устройство карточки повторяет ход мысли оператора:
 *   шапка   — что это и от кого (метки, имя, когда прислали);
 *   тело    — что именно просят (в лунке: это данные, а не интерфейс);
 *   решение — принять / вернуть с причиной, отделено чертой.
 *
 * Формы решения приходят снаружи: у каждой очереди свои server actions, а
 * «принять» и «вернуть» это две ОТДЕЛЬНЫЕ формы (у возврата причина
 * обязательна, и браузерная проверка `required` не должна мешать одобрению).
 * Атом отвечает за раскладку, а не за то, куда уходит нажатие.
 *
 * Без "use client": разметка чистая.
 */

/** Карточка очереди целиком. Внутрь кладут `QueueNote` и `QueueDecision`. */
export function QueueCard({
  tags,
  title,
  meta,
  children,
}: {
  /** Метки слева в шапке: статус, источник, дивизион. Обычно `StatusPill`/`Chip`. */
  tags?: ReactNode;
  /** Кто/что: ник, название команды, почта. */
  title: ReactNode;
  /** Правый край шапки: когда прислали. Прижимается вправо, на узком уходит вниз. */
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-card bg-surface px-(--s5) pb-[calc(var(--s5)+var(--lip)/2)] pt-[calc(var(--s5)-var(--lip)/2)] font-pouf cushion-card">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
        {tags}
        <span className="min-w-0 text-[15px] font-black tracking-[-0.2px] text-ink">{title}</span>
        {meta && <span className="ml-auto shrink-0 text-xs font-bold text-muted">{meta}</span>}
      </div>
      {children && <div className="mt-3 space-y-3">{children}</div>}
    </div>
  );
}

/**
 * Содержание заявки — вдавленная лунка. Глубина здесь несёт смысл: внутри лежат
 * ЧУЖИЕ данные (то, что прислал человек), а не элементы интерфейса оператора.
 */
export function QueueNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-blob bg-surface-2 px-(--s4) py-(--s3) text-[13px] font-bold leading-[1.5] text-ink-muted cushion-field">
      {children}
    </div>
  );
}

/**
 * Подвал решения: «принять» слева, «вернуть с причиной» — растягивающейся
 * формой справа. Отделён чертой — до неё читают, после неё нажимают.
 *
 * Черта тонкая и на поверхности: рисовать вторую подушку внутри подушки ради
 * подвала значило бы дать три глубины на одной карточке.
 */
export function QueueDecision({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-hairline pt-3">{children}</div>
  );
}
