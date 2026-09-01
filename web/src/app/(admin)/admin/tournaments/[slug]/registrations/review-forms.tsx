"use client";

import { useActionState } from "react";
import { approve, reject, type ReviewState } from "./actions";
import { Button } from "@/components/pouf/Button";
import { FormInput } from "@/components/pouf/Input";

// Решение по одной заявке команды: одобрить или вернуть с причиной. Две формы рядом, а не одна с
// двумя кнопками — у возврата причина обязательна, и браузерная проверка `required` не должна
// мешать одобрению (тот же приём, что в очереди регистраций игроков).

const errorBox = "rounded-md border border-rose-200 bg-rose-100 px-3 py-2 text-sm text-rose-700";

export function ReviewForms({
  id,
  tournamentSlug,
  blocked,
}: {
  id: number;
  tournamentSlug: string;
  /** Есть непроходимая проблема — одобрение закрыто: такие данные развалят ростер. */
  blocked: boolean;
}) {
  const [okState, approveAction, approving] = useActionState<ReviewState, FormData>(approve, null);
  const [noState, rejectAction, rejecting] = useActionState<ReviewState, FormData>(reject, null);
  const busy = approving || rejecting;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <form action={approveAction} className="flex items-end gap-2">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="tournamentSlug" value={tournamentSlug} />
          <Button type="submit" size="sm" disabled={busy || blocked}>
            {approving ? "Завожу…" : "Одобрить"}
          </Button>
        </form>

        <form action={rejectAction} className="flex flex-1 items-end gap-2">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="tournamentSlug" value={tournamentSlug} />
          <div className="min-w-[12rem] flex-1 space-y-1">
            <label className="block text-xs text-ink-subtle">Причина возврата</label>
            <FormInput name="reason" required placeholder="Чего не хватает в заявке" />
          </div>
          <Button type="submit" size="sm" variant="quiet" disabled={busy}>
            {rejecting ? "Возвращаю…" : "Вернуть"}
          </Button>
        </form>
      </div>

      {blocked && (
        <p className="text-xs text-rose-700">
          Одобрение закрыто, пока есть красные замечания — их видно в списке выше.
        </p>
      )}
      {(okState?.error || noState?.error) && <p className={errorBox}>{okState?.error ?? noState?.error}</p>}
      {(okState?.ok || noState?.ok) && <p className="text-sm text-emerald-700">{okState?.ok ?? noState?.ok}</p>}
    </div>
  );
}
