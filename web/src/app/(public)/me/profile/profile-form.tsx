"use client";

import { useActionState } from "react";
import { saveProfile, type SaveState } from "./actions";
import { Button } from "@/components/pouf/Button";
import { Alert } from "@/components/pouf/feedback";
import { DateField } from "@/components/pouf/date-field";
import { FormInput, Label } from "@/components/pouf/Input";

// Форма правки своей анкеты.
//
// Полей два сорта, и правило одно на оба входа — сайт и бот (решение 04.09.2026):
//   · чем человек ПРЕДСТАВЛЕН лиге (ник, город, ссылка на профиль, MMR) — уходит заявкой
//     в очередь модерации, ту же, куда их шлёт бот (`src/lib/profile-edit.ts`);
//   · что касается только его самого (имя, страна, дата рождения, телеграм) — пишется сразу.
// До этого сайт писал напрямую всё, а бот те же поля гнал через оператора: «ник проверяют глазами»
// было правдой ровно для тех, кто пришёл из телеграма.
//
// Роль в составе, TP, номер и фото сюда по-прежнему не входят: это решения лиги, а не анкета.

export type ProfileValues = {
  nickname: string;
  realName: string;
  city: string;
  country: string;
  birthday: string; // yyyy-mm-dd
  telegram: string;
  profileUrl: string;
  mmr: string;
};

/** Чем кончилась последняя заявка по полю: ждёт решения или вернули с причиной. */
export type FieldReview =
  | { state: "pending"; value: string }
  | { state: "rejected"; value: string; reason: string };

/** Ключи — поля этой формы, идущие через очередь. */
export type Reviews = Partial<Record<"nickname" | "city" | "profileUrl" | "mmr", FieldReview>>;

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-[13px] font-bold leading-[1.45] text-muted">{hint}</p>}
    </div>
  );
}

/**
 * Поле, которое проверяет оператор. Пока заявка в работе, поле показывает присланное и заблокировано:
 * вторую заявку на то же поле очередь всё равно не примет (`submitProfileEdit`), и сказать об этом
 * до отправки честнее, чем отбить после.
 */
function QueuedField({
  label,
  name,
  value,
  review,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  review?: FieldReview;
  hint?: string;
}) {
  const waiting = review?.state === "pending" ? review : null;
  return (
    <div className="space-y-2">
      <Field
        label={label}
        hint={waiting ? `Ждёт решения организатора: «${waiting.value}».` : hint}
      >
        <FormInput name={name} defaultValue={waiting ? waiting.value : value} disabled={!!waiting} />
      </Field>
      {review?.state === "rejected" && (
        <Alert tone="err" block>
          «{review.value}» организатор вернул{review.reason ? `: ${review.reason}` : ""}. Поправьте и пришлите снова.
        </Alert>
      )}
    </div>
  );
}

export function ProfileForm({ values, reviews }: { values: ProfileValues; reviews: Reviews }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveProfile, null);

  return (
    <form action={action} className="space-y-5 font-pouf">
      <QueuedField
        label="Ник в лиге"
        name="nickname"
        value={values.nickname}
        review={reviews.nickname}
        hint="Отображаемое имя. Менять можно раз в сезон, и смену подтверждает организатор."
      />

      <Field label="Имя">
        <FormInput name="realName" defaultValue={values.realName} placeholder="Как вас зовут" />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <QueuedField label="Город" name="city" value={values.city} review={reviews.city} />
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

      <QueuedField
        label="Ссылка на профиль"
        name="profileUrl"
        value={values.profileUrl}
        review={reviews.profileUrl}
        hint="Dotabuff, Stratz или Steam — любая. Из неё определяем account_id, по нему вас находят в матчах лиги."
      />

      <QueuedField
        label="MMR"
        name="mmr"
        value={values.mmr}
        review={reviews.mmr}
        hint="Со слов игрока — новое значение проверяет организатор."
      />

      <Alert tone="info" block>
        Ник, город, ссылку и MMR подтверждает организатор — они появятся в профиле после его решения.
        Роль в составе, TP, номер и фото ведёт он же, этих полей здесь нет.
      </Alert>

      <Button type="submit" disabled={pending} block>
        {pending ? "Сохраняю…" : "Сохранить анкету"}
      </Button>

      {state?.error && (
        <Alert tone="err" block>
          {state.error}
        </Alert>
      )}
      {state?.ok && (
        <Alert tone="ok">
          {state.sent?.length
            ? `Анкета сохранена. На проверку ушло: ${state.sent.join(", ")}.`
            : "Анкета сохранена."}
        </Alert>
      )}
    </form>
  );
}
