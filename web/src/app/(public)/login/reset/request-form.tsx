"use client";

import { useActionState } from "react";
import Link from "next/link";
import { askReset, type RequestState } from "./actions";
import { Button } from "@/components/pouf/Button";
import { Alert } from "@/components/pouf/feedback";
import { FormInput, Label } from "@/components/pouf/Input";

// Два состояния одного экрана: форма запроса и ответ на неё. Ответ один на все исходы — см. ниже.

export function RequestForm({ botUrl, ttlMin }: { botUrl: string | null; ttlMin: number }) {
  const [state, action, pending] = useActionState<RequestState, FormData>(askReset, null);

  if (state?.sent) return <Sent botUrl={botUrl} ttlMin={ttlMin} />;

  return (
    <form action={action} className="space-y-4">
      <p className="text-[13px] font-bold leading-[1.5] text-muted">
        Писем лига не шлёт — ни одного и никогда. Ссылку на смену пароля пришлёт телеграм-бот тому,
        у кого он привязан к аккаунту.
      </p>
      <div className="space-y-2">
        <Label>Почта аккаунта</Label>
        <FormInput name="email" type="email" autoComplete="email" placeholder="you@gmail.com" required />
      </div>
      <Button type="submit" loading={pending} size="lg" block>
        {pending ? "Отправляю…" : "Прислать ссылку"}
      </Button>
      {state?.error && (
        <Alert tone="err" block>
          {state.error}
        </Alert>
      )}
    </form>
  );
}

/**
 * Ответ на запрос. ОДИН на все случаи: аккаунт есть с телеграмом, аккаунт есть без телеграма,
 * аккаунта нет вовсе. Развести их на разные экраны — значит отдать форме роль проверялки чужих
 * почт: подставил адрес, прочитал ответ, узнал, кто в лиге есть. Поэтому текст говорит сразу про
 * обе ветки, а какая из них твоя — знает только владелец аккаунта.
 */
function Sent({ botUrl, ttlMin }: { botUrl: string | null; ttlMin: number }) {
  return (
    <div className="space-y-4">
      <Alert tone="ok" block>
        Если у этой почты есть аккаунт с привязанным телеграмом, ссылка уже в боте. Она одноразовая
        и живёт {ttlMin} минут.
      </Alert>

      <div className="rounded-blob bg-surface-2 px-4 py-3.5 cushion-field">
        <p className="text-[13px] font-black text-ink">Телеграм к аккаунту не привязан?</p>
        <p className="mt-1.5 text-[13px] font-bold leading-[1.5] text-muted">
          Тогда прислать ссылку некуда, и вернуть вход может только организатор лиги — он выдаёт её
          вручную.{" "}
          {botUrl ? (
            <>
              Напишите ему в{" "}
              <a
                href={botUrl}
                target="_blank"
                rel="noreferrer"
                className="font-black text-[var(--accent-ink)] underline-offset-4 hover:underline"
              >
                бот лиги
              </a>{" "}
              — с какой почтой заведён аккаунт и под каким ником вы играете.
            </>
          ) : (
            <>
              Как с ним связаться — на странице{" "}
              <Link href="/contact" className="font-black text-[var(--accent-ink)] underline-offset-4 hover:underline">
                «Связаться»
              </Link>
              .
            </>
          )}
        </p>
      </div>

      <p className="text-[13px] font-bold leading-[1.5] text-muted">
        Ссылка не пришла и телеграм точно привязан? Проверьте, что бот не заблокирован, и{" "}
        <Link href="/login/reset" className="font-black text-ink underline-offset-4 hover:underline">
          запросите ещё раз
        </Link>
        .
      </p>
    </div>
  );
}
