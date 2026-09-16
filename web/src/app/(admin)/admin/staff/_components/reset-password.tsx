"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/pouf/Button";
import { Alert } from "@/components/pouf/feedback";
import { FormInput } from "@/components/pouf/Input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/pouf/alert-dialog";
import type { ResetLinkState } from "../actions";

// Сброс пароля оператором (ТЗ 02). Оператор выдаёт ОДНОРАЗОВУЮ ССЫЛКУ и передаёт её человеку сам —
// пароля он не видит и задать его не может: новый пароль придумывает владелец аккаунта на странице
// по ссылке. Поэтому здесь нет и не должно появиться поля «новый пароль».
//
// Диалог, а не кнопка в строке: ссылку надо показать целиком и дать скопировать, а в ячейке
// таблицы такая строка ломает раскладку. Подтверждение — Radix, как у удаления аккаунта.

export function ResetPassword({
  id,
  who,
  hasTelegram,
  lastReset,
  ttlMin,
  action,
}: {
  id: number;
  who: string;
  /** Привязан ли телеграм: тогда человек может сбросить пароль и сам, без оператора. */
  hasTelegram: boolean;
  /** След прошлого сброса одной строкой, либо null — сбросов не было. */
  lastReset: string | null;
  /** Срок жизни ссылки — из `lib/password-reset.ts`: тот модуль серверный, числом его сюда не тянут. */
  ttlMin: number;
  action: (state: ResetLinkState, form: FormData) => Promise<ResetLinkState>;
}) {
  const [state, submit, pending] = useActionState<ResetLinkState, FormData>(action, null);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" size="sm" variant="quiet">
          Сброс пароля
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Сбросить пароль «{who}»?</AlertDialogTitle>
          <AlertDialogDescription>
            Выдаётся одноразовая ссылка на {ttlMin} минут — передайте её человеку сами. Пароль он задаст
            себе на странице по ссылке; вы его не увидите и задать не сможете. Прежние входы в этот
            аккаунт после смены пароля разлогинятся.
            {hasTelegram && " У аккаунта привязан телеграм — человек может запросить ссылку и сам, «Забыли пароль?» на входе."}
            {lastReset && ` Прошлый сброс: ${lastReset}.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {state?.url ? (
          <ResetLink url={state.url} />
        ) : (
          <form action={submit}>
            <input type="hidden" name="accountId" value={id} />
            {state?.error && (
              <Alert tone="err" block className="mb-3">
                {state.error}
              </Alert>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel type="button" disabled={pending}>
                Отмена
              </AlertDialogCancel>
              {/* Не AlertDialogAction: она закрывает диалог по клику, а ссылку надо показать
                  в нём же — закрывшийся диалог унёс бы её с собой. */}
              <Button type="submit" loading={pending}>
                {pending ? "Выдаю…" : "Выдать ссылку"}
              </Button>
            </AlertDialogFooter>
          </form>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Готовая ссылка: поле только для чтения плюс копирование. Ссылка одноразовая — показываем её
 *  один раз и прямо говорим об этом: второй раз эту же не достать, придётся выдавать новую. */
function ResetLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-3">
      <Alert tone="warn" block>
        Скопируйте ссылку сейчас — повторно она не показывается.
      </Alert>
      <FormInput readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
      <AlertDialogFooter>
        <AlertDialogCancel type="button">Закрыть</AlertDialogCancel>
        <Button
          type="button"
          onClick={() => {
            // Буфера может не быть (http без localhost, старый webview) — тогда поле остаётся
            // единственным способом, и врать «скопировано» в этом случае нельзя.
            navigator.clipboard?.writeText(url).then(
              () => setCopied(true),
              () => setCopied(false),
            );
          }}
        >
          {copied ? "Скопировано" : "Скопировать"}
        </Button>
      </AlertDialogFooter>
    </div>
  );
}
