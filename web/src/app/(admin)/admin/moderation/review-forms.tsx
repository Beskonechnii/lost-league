"use client";

import { useActionState } from "react";
import { approve, approveEdit, approveLink, reject, rejectEdit, rejectLink, type ReviewState } from "./actions";
import { Button } from "@/components/pouf/Button";
import { FormInput, Label } from "@/components/pouf/Input";
import { Alert } from "@/components/pouf/feedback";
import { QueueDecision } from "@/components/pouf/queue-card";

// Решение по одной заявке. Две формы рядом, а не одна с двумя кнопками: у отказа причина
// обязательна, и браузерная проверка `required` не должна мешать одобрению.

export function ReviewForms({
  accountId,
  mmr,
  link = false,
  reasonRequired = true,
}: {
  accountId: number;
  /** Заявленный MMR для поля оператора; undefined — ветка «я уже в ростере», где поля нет вовсе:
   *  профиль с его MMR уже заведён, и апрув его не трогает. (null — «анкета есть, MMR не указал».) */
  mmr?: number | null;
  /** Заявка на привязку: те же две кнопки, но своя пара экшенов — отказ по привязке не выкидывает
   *  из лиги уже открытый аккаунт. */
  link?: boolean;
  /** Причина обязательна там, где отказ виден человеку в кабинете (аккаунт ждёт решения). */
  reasonRequired?: boolean;
}) {
  const [okState, approveAction, approving] = useActionState<ReviewState, FormData>(
    link ? approveLink : approve,
    null,
  );
  const [noState, rejectAction, rejecting] = useActionState<ReviewState, FormData>(
    link ? rejectLink : reject,
    null,
  );
  const busy = approving || rejecting;

  return (
    <div className="space-y-2">
      <QueueDecision>
        <form action={approveAction} className="flex items-end gap-2">
          <input type="hidden" name="accountId" value={accountId} />
          {mmr !== undefined && (
            <div className="w-28">
              <Label htmlFor={`mmr-${accountId}`}>MMR в лигу</Label>
              <FormInput
                id={`mmr-${accountId}`}
                name="mmr"
                size="sm"
                inputMode="numeric"
                defaultValue={mmr == null ? "" : String(mmr)}
                className="mt-1.5"
              />
            </div>
          )}
          <Button type="submit" size="sm" disabled={busy}>
            {approving ? "Одобряю…" : "Одобрить"}
          </Button>
        </form>

        <form action={rejectAction} className="flex flex-1 items-end gap-2">
          <input type="hidden" name="accountId" value={accountId} />
          {/* Поля причины нет там, где отказ никому не показывается: у открытого аккаунта отклонённая
              привязка просто снимается, и просить формулировку «в никуда» незачем. */}
          {reasonRequired && (
            <div className="min-w-[12rem] flex-1">
              <Label htmlFor={`reason-${accountId}`}>Причина возврата</Label>
              <FormInput
                id={`reason-${accountId}`}
                name="reason"
                size="sm"
                required
                placeholder={link ? "Почему это не он" : "Чего не хватает в анкете"}
                className="mt-1.5"
              />
            </div>
          )}
          <Button type="submit" size="sm" variant="quiet" disabled={busy}>
            {rejecting ? (reasonRequired ? "Возвращаю…" : "Отклоняю…") : reasonRequired ? "Вернуть" : "Отклонить"}
          </Button>
        </form>
      </QueueDecision>

      {(okState?.error || noState?.error) && (
        <Alert tone="err" block>{okState?.error ?? noState?.error}</Alert>
      )}
    </div>
  );
}

/**
 * Решение по правке профиля из бота. Форм снова две, а не одна: у возврата причина обязательна —
 * человек увидит её в боте и пришлёт исправленное.
 */
export function EditReviewForms({ editId }: { editId: number }) {
  const [okState, approveAction, approving] = useActionState<ReviewState, FormData>(approveEdit, null);
  const [noState, rejectAction, rejecting] = useActionState<ReviewState, FormData>(rejectEdit, null);
  const busy = approving || rejecting;

  return (
    <div className="space-y-2">
      <QueueDecision>
        <form action={approveAction}>
          <input type="hidden" name="editId" value={editId} />
          <Button type="submit" size="sm" disabled={busy}>
            {approving ? "Применяю…" : "Применить"}
          </Button>
        </form>

        <form action={rejectAction} className="flex flex-1 items-end gap-2">
          <input type="hidden" name="editId" value={editId} />
          <div className="min-w-[12rem] flex-1">
            <Label htmlFor={`edit-reason-${editId}`}>Причина возврата</Label>
            <FormInput
              id={`edit-reason-${editId}`}
              name="reason"
              size="sm"
              required
              placeholder="Почему так нельзя"
              className="mt-1.5"
            />
          </div>
          <Button type="submit" size="sm" variant="quiet" disabled={busy}>
            {rejecting ? "Возвращаю…" : "Вернуть"}
          </Button>
        </form>
      </QueueDecision>

      {(okState?.error || noState?.error) && (
        <Alert tone="err" block>{okState?.error ?? noState?.error}</Alert>
      )}
    </div>
  );
}
