"use client";

import { useActionState } from "react";
import { saveProfile, type SaveState } from "./actions";
import { Button } from "@/components/pouf/Button";
import { Alert } from "@/components/pouf/feedback";
import { FormInput, FormTextarea, Label } from "@/components/pouf/Input";

// Форма правки своей анкеты. Только поля, которые игрок ведёт сам; MMR/роль/TP/фото сюда не входят —
// их правит оператор. Ник — с оговоркой про лимит «раз в сезон» (проверку делает server-action).

export type ProfileValues = {
  nickname: string;
  realName: string;
  city: string;
  country: string;
  birthday: string; // yyyy-mm-dd для <input type=date>
  telegram: string;
  dotabuffUrl: string;
  stratzUrl: string;
  steamUrl: string;
  achievements: string;
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-[13px] font-bold leading-[1.45] text-muted">{hint}</p>}
    </div>
  );
}

export function ProfileForm({ values }: { values: ProfileValues }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveProfile, null);

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
        <FormInput name="birthday" type="date" defaultValue={values.birthday} />
      </Field>

      <Field label="Telegram" hint="Можно с @ или ссылкой — приведём к хендлу.">
        <FormInput name="telegram" defaultValue={values.telegram} placeholder="@nickname" />
      </Field>

      <Field label="Dotabuff" hint="Из ссылок определяем ваш account_id — по нему вас находят в матчах лиги.">
        <FormInput name="dotabuffUrl" defaultValue={values.dotabuffUrl} placeholder="https://www.dotabuff.com/players/…" />
      </Field>

      <Field label="Stratz">
        <FormInput name="stratzUrl" defaultValue={values.stratzUrl} placeholder="https://stratz.com/players/…" />
      </Field>

      <Field label="Steam">
        <FormInput name="steamUrl" defaultValue={values.steamUrl} placeholder="https://steamcommunity.com/profiles/…" />
      </Field>

      <Field label="Достижения" hint="Свободный список — одна строка на достижение.">
        <FormTextarea name="achievements" defaultValue={values.achievements} rows={4} />
      </Field>

      <Alert tone="info" block>
        MMR, роль в составе, TP, номер и фото ведёт организатор — этих полей здесь нет.
      </Alert>

      <Button type="submit" disabled={pending} block>
        {pending ? "Сохраняю…" : "Сохранить анкету"}
      </Button>

      {state?.error && <Alert tone="err" block>{state.error}</Alert>}
      {state?.ok && <Alert tone="ok">Анкета сохранена.</Alert>}
    </form>
  );
}
