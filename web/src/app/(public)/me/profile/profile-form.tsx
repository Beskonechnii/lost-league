"use client";

import { useActionState } from "react";
import { saveProfile, type SaveState } from "./actions";
import { Button } from "@/components/pouf/Button";
import { Alert } from "@/components/pouf/feedback";
import { DateField } from "@/components/pouf/date-field";
import { FormInput, Label } from "@/components/pouf/Input";

// Форма правки своей анкеты. Поля, которые игрок ведёт сам, пишутся сразу; MMR — исключение:
// он уходит ЗАЯВКОЙ в очередь модерации (решение 04.09.2026). Перед новым турниром люди приходят
// именно за ним, а верить числу на слово лига не может — поэтому поле есть, но пишет его оператор.
// Роль в составе, TP, номер и фото сюда по-прежнему не входят: это решения лиги, а не анкета.
// Ник — с оговоркой про лимит «раз в сезон» (проверку делает server-action).

export type ProfileValues = {
  nickname: string;
  realName: string;
  city: string;
  country: string;
  birthday: string; // yyyy-mm-dd для <input type=date>
  telegram: string;
  profileUrl: string;
  mmr: string;
};

/** Чем кончилась последняя заявка на MMR: ждёт решения или вернули с причиной. */
export type MmrReview =
  | { state: "pending"; value: string }
  | { state: "rejected"; value: string; reason: string }
  | null;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-[13px] font-bold leading-[1.45] text-muted">{hint}</p>}
    </div>
  );
}

export function ProfileForm({ values, mmrReview }: { values: ProfileValues; mmrReview: MmrReview }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveProfile, null);
  // Заявка в работе — поле только показывает присланное: вторую на то же поле очередь не примет.
  const waiting = mmrReview?.state === "pending" ? mmrReview : null;

  return (
    <form action={action} className="space-y-5 font-pouf">
      <Field label="Ник в лиге" hint="Отображаемое имя. Менять можно раз в сезон.">
        <FormInput name="nickname" defaultValue={values.nickname} required />
      </Field>

      <Field label="Имя">
        <FormInput name="realName" defaultValue={values.realName} placeholder="Как вас зовут" />
      </Field>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Field label="Город">
          <FormInput name="city" defaultValue={values.city} />
        </Field>
        <Field label="Страна">
          <FormInput name="country" defaultValue={values.country} />
        </Field>
      </div>

      <Field label="Дата рождения">
        <DateField name="birthday" defaultValue={values.birthday} />
      </Field>

      <Field label="Telegram" hint="Можно с @ или ссылкой — приведём к хендлу.">
        <FormInput name="telegram" defaultValue={values.telegram} placeholder="@nickname" />
      </Field>

      <Field
        label="Ссылка на профиль"
        hint="Dotabuff, Stratz или Steam — любая. Из неё определяем account_id, по нему вас находят в матчах лиги, а адреса остальных площадок достраиваются сами."
      >
        <FormInput name="profileUrl" defaultValue={values.profileUrl} placeholder="https://www.dotabuff.com/players/…" />
      </Field>

      <Field
        label="MMR"
        hint={
          waiting ? undefined : "Новое значение уходит организатору на проверку — в профиле оно появится после его решения."
        }
      >
        <FormInput
          name="mmr"
          inputMode="numeric"
          defaultValue={waiting ? waiting.value : values.mmr}
          disabled={!!waiting}
          placeholder="Например, 4200"
        />
      </Field>

      {waiting && (
        <Alert tone="info" block>
          MMR {waiting.value} ждёт решения организатора. Пока он не решит, новую заявку прислать нельзя.
        </Alert>
      )}
      {mmrReview?.state === "rejected" && (
        <Alert tone="err" block>
          MMR {mmrReview.value} организатор вернул{mmrReview.reason ? `: ${mmrReview.reason}` : ""}. Поправьте и пришлите снова.
        </Alert>
      )}

      <Alert tone="info" block>
        Роль в составе, TP, номер и фото ведёт организатор — этих полей здесь нет.
      </Alert>

      <Button type="submit" disabled={pending} block>
        {pending ? "Сохраняю…" : "Сохранить анкету"}
      </Button>

      {state?.error && <Alert tone="err" block>{state.error}</Alert>}
      {state?.ok && <Alert tone="ok">{state.mmrSent ? "Анкета сохранена. MMR ушёл организатору на проверку." : "Анкета сохранена."}</Alert>}
    </form>
  );
}
