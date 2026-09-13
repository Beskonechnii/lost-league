"use client";

import { Button, type ButtonSize } from "@/components/pouf/Button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/pouf/alert-dialog";

// Подтверждение записи в заполненный дивизион — ОДИН диалог на все пути записи: апрув заявки,
// ручное добавление команды и перестановка её между дивизионами. Текст с числами считает слой
// данных (`overflowWarning` в src/lib/tournaments.ts), здесь только показ и подтверждение.
//
// Запрета нет намеренно: лимит — правило лиги, а не ограничение базы, и последнее слово
// за организатором (решение Стаса 13.09.2026). Поэтому кнопка не блокируется, а спрашивает.
//
// Кнопка подтверждения отправляет форму по `form={formId}`, а не лежит внутри неё: диалог Radix
// рисуется в портале вне формы, и вложить туда её поля нельзя.

export function ConfirmOverflow({
  formId,
  warning,
  disabled,
  size = "sm",
  variant = "solid",
  children,
}: {
  /** id формы, которую отправляет подтверждение. */
  formId: string;
  /** Текст предупреждения с числами; null — лимит записи не мешает, спрашивать не о чем. */
  warning: string | null;
  disabled?: boolean;
  size?: ButtonSize;
  variant?: "solid" | "quiet";
  children: React.ReactNode;
}) {
  if (!warning) {
    return (
      <Button type="submit" form={formId} size={size} variant={variant} disabled={disabled}>
        {children}
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" size={size} variant={variant} disabled={disabled}>
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Дивизион заполнен</AlertDialogTitle>
          <AlertDialogDescription>
            {warning}. Лимит — правило лиги, а не запрет: записать сверх него можно, счётчик покажет
            фактическое число.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button">Отмена</AlertDialogCancel>
          <AlertDialogAction type="submit" form={formId}>
            Записать всё равно
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
