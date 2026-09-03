"use client";

import { useActionState } from "react";
import { acceptInvite, declineInvite, type InviteState } from "./actions";
import { Button } from "@/components/pouf/Button";
import { Alert } from "@/components/pouf/feedback";

// Две кнопки одного приглашения. Клиентский кусок нужен только ради `useActionState`: сама
// страница серверная, а ответ — обычный server-action с двумя входами (принять / отказаться).

export function InviteActions({ memberId }: { memberId: number }) {
  const [yes, accept, accepting] = useActionState<InviteState, FormData>(acceptInvite, null);
  const [no, decline, declining] = useActionState<InviteState, FormData>(declineInvite, null);
  const state = yes ?? no;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <form action={accept}>
          <input type="hidden" name="memberId" value={memberId} />
          <Button type="submit" size="sm" loading={accepting} disabled={declining}>
            Подтвердить участие
          </Button>
        </form>
        <form action={decline}>
          <input type="hidden" name="memberId" value={memberId} />
          <Button type="submit" size="sm" variant="quiet" loading={declining} disabled={accepting}>
            Отказаться
          </Button>
        </form>
      </div>
      {state?.error && (
        <Alert tone="err" block>
          {state.error}
        </Alert>
      )}
      {state?.ok && <Alert tone="ok">{state.ok}</Alert>}
    </div>
  );
}
