import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/* Обратная связь — перенос артборда Кита «Данные и обратная связь» (Э7 RELEASE-PLAN):
 * алерт (полный и мини) и пустое состояние.
 *
 * Зачем атомом, а не по месту. До Э7 сообщение об ошибке верстали в каждом файле
 * своими руками — `rounded-md border border-rose-200 bg-rose-100 text-rose-700`,
 * `border-amber-200 bg-amber-100`, `border-sky-200 bg-sky-100`. Это три разных
 * рисунка одной мысли и три сырых литерала мимо токенов: заливки статусов уже
 * живут в `pouf.css` (--grad-ok/warn/err/info и их ink). Теперь экран говорит
 * тоном («это блокирует», «это предупреждение»), а как он выглядит — знает Кит.
 *
 * Без "use client": чистая разметка, её тянут и серверные страницы.
 */

export type AlertTone = "ok" | "warn" | "err" | "info";

/** Заливка и ink статуса — из токенов Кита, ни одного литерала. */
const TONE: Record<AlertTone, { bg: string; ink: string; icon: IconName }> = {
  ok: { bg: "var(--grad-ok)", ink: "var(--color-ok-ink)", icon: "ok" },
  warn: { bg: "var(--grad-warn)", ink: "var(--color-warn-ink)", icon: "warn" },
  err: { bg: "var(--grad-err)", ink: "var(--color-err-ink)", icon: "fail" },
  info: { bg: "var(--grad-info)", ink: "var(--color-info-ink)", icon: "info" },
};

/**
 * Алерт Кита: круглый значок в белой лунке и текст на пастельной заливке.
 *
 * Кит рисует его inline-flex — плашка обжимает содержимое, а не растягивается на
 * колонку: «Заявка принята» шириной в экран читается как баннер, а это реплика.
 * `block` возвращает растяжение там, где сообщение длинное (абзац-объяснение).
 */
export function Alert({
  tone = "info",
  icon,
  mini = false,
  block = false,
  className = "",
  children,
}: {
  tone?: AlertTone;
  /** Свой значок вместо значка тона — например «часы» у закрытого приёма заявок. */
  icon?: IconName;
  /** Мини-пилюля Кита (`.alert.mini`): статус в строке, а не сообщение. */
  mini?: boolean;
  /** Растянуть на всю ширину — для длинного текста в колонку. */
  block?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const t = TONE[tone];
  return (
    <div
      role="status"
      className={`${block ? "flex w-full" : "inline-flex max-w-full"} items-center font-pouf cushion-alert ${
        mini ? "gap-2 rounded-pill py-1.5 pl-2 pr-3 text-xs font-extrabold" : "gap-2.5 rounded-chip px-[15px] py-[11px] text-[13px] font-extrabold"
      } ${className}`}
      style={{ backgroundImage: t.bg, color: t.ink }}
    >
      <span
        className={`grid shrink-0 place-items-center rounded-pill bg-[rgba(255,255,255,0.72)] [box-shadow:0_0_0_1px_rgba(255,255,255,.5),inset_1px_1px_2px_#fff,inset_-1px_-2px_3px_rgba(0,0,0,.08),0_3px_5px_-1px_rgba(0,0,0,.16)] ${
          mini ? "h-[22px] w-[22px]" : "h-7 w-7"
        }`}
      >
        <Icon name={icon ?? t.icon} size="sm" />
      </span>
      <span className="min-w-0 leading-[1.45]">{children}</span>
    </div>
  );
}

/**
 * Пустое состояние Кита (`.empty`): вдавленная лунка, значок, заголовок и одна
 * фраза о том, почему пусто и кто это чинит. Пустой экран без объяснения читается
 * как поломка — поэтому текст обязателен, а не опционален.
 */
export function EmptyState({
  icon = "search",
  title,
  children,
}: {
  icon?: IconName;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card bg-surface-2 p-8 text-center font-pouf cushion-field">
      <span className="grid h-[52px] w-[52px] place-items-center rounded-[14px] bg-surface text-muted cushion-row">
        <Icon name={icon} size="md" />
      </span>
      <div className="mt-1 text-[17px] font-black tracking-[-0.2px] text-ink">{title}</div>
      {children && (
        <p className="max-w-[280px] text-[13px] font-bold leading-[1.5] text-muted">{children}</p>
      )}
    </div>
  );
}
