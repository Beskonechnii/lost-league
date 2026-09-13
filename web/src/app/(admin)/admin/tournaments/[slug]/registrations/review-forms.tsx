"use client";

import { useActionState } from "react";
import { approve, reject, type ReviewState } from "./actions";
import { Button } from "@/components/pouf/Button";
import { FormInput, Label } from "@/components/pouf/Input";
import { Alert } from "@/components/pouf/feedback";
import { QueueDecision } from "@/components/pouf/queue-card";
import { ConfirmOverflow } from "../../_components/confirm-overflow";

// Решение по одной заявке команды: одобрить или вернуть с причиной. Две формы рядом, а не одна с
// двумя кнопками — у возврата причина обязательна, и браузерная проверка `required` не должна
// мешать одобрению (тот же приём, что в очереди регистраций игроков).

export function ReviewForms({
  id,
  tournamentSlug,
  blocked,
  overflow,
}: {
  id: number;
  tournamentSlug: string;
  /** Есть непроходимая проблема — одобрение закрыто: такие данные развалят ростер. */
  blocked: boolean;
  /** Дивизион заявки заполнен — текст с числами; null — лимит записи не мешает. */
  overflow: string | null;
}) {
  const [okState, approveAction, approving] = useActionState<ReviewState, FormData>(approve, null);
  const [noState, rejectAction, rejecting] = useActionState<ReviewState, FormData>(reject, null);
  const busy = approving || rejecting;

  return (
    <div className="space-y-2">
      <QueueDecision>
        {/* Апрув в заполненный дивизион спрашивает подтверждение — тот же диалог, что у ручного
            добавления и перестановки команды (ConfirmOverflow). */}
        <form id={`approve-${id}`} action={approveAction} className="flex items-end gap-2">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="tournamentSlug" value={tournamentSlug} />
          <ConfirmOverflow formId={`approve-${id}`} warning={overflow} disabled={busy || blocked}>
            {approving ? "Завожу…" : "Одобрить"}
          </ConfirmOverflow>
        </form>

        <form action={rejectAction} className="flex flex-1 items-end gap-2">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="tournamentSlug" value={tournamentSlug} />
          <div className="min-w-[12rem] flex-1">
            <Label htmlFor={`reason-${id}`}>Причина возврата</Label>
            <FormInput
              id={`reason-${id}`}
              name="reason"
              size="sm"
              required
              placeholder="Чего не хватает в заявке"
              className="mt-1.5"
            />
          </div>
          <Button type="submit" size="sm" variant="quiet" disabled={busy}>
            {rejecting ? "Возвращаю…" : "Вернуть"}
          </Button>
        </form>
      </QueueDecision>

      {blocked && (
        <Alert tone="err" block>
          Одобрение закрыто, пока есть красные замечания — их видно в списке выше.
        </Alert>
      )}
      {(okState?.error || noState?.error) && (
        <Alert tone="err" block>{okState?.error ?? noState?.error}</Alert>
      )}
      {(okState?.ok || noState?.ok) && <Alert tone="ok" block>{okState?.ok ?? noState?.ok}</Alert>}
    </div>
  );
}
