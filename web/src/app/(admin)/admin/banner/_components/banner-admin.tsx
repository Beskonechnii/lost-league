"use client";

import { useState } from "react";
import { Field, FormInput, FormTextarea } from "@/components/pouf/Input";
import { Alert } from "@/components/pouf/feedback";
import { Toggle } from "@/components/pouf/toggle";
import { ImageField, SaveButton } from "@/app/_components/form";
import { BANNER_LIMITS, isExternalHref, missingFields, type BannerDraft } from "@/lib/home-banner";
import { Panel } from "../../../_components/panel";

// Форма баннера главной. Состояние — один черновик целиком и одна кнопка на весь экран: баннер
// показывается только заполненным целиком, поэтому и сохранять его по полю бессмысленно.
//
// Пределы длины стоят `maxLength` на самих полях, а не проверкой после сохранения: оператор
// должен упереться в границу, пока печатает, — иначе он узнаёт о ней, увидев обрезанный хвост
// на главной. Числа — мера верхнего ряда витрины (см. ТЗ 25, DESIGN §2).

export function BannerAdmin({ initial, fallback }: { initial: BannerDraft; fallback: string }) {
  const [draft, setDraft] = useState(initial);
  const set = <K extends keyof BannerDraft>(key: K, value: BannerDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const missing = missingFields(draft);
  const len = (v: string | null) => (v ?? "").length;

  return (
    <div className="mt-6 space-y-4">
      {missing.length === 0 && !draft.enabled && (
        <Alert tone="info" block>
          Баннер заполнен, но выключен — на главной работает герой по данным: {fallback}.
        </Alert>
      )}
      {missing.length > 0 && (
        <Alert tone={missing.length === 5 ? "info" : "warn"} block>
          {missing.length === 5
            ? `Баннер не задан — на главной работает герой по данным: ${fallback}.`
            : `Не хватает: ${missing.join(", ")}. Пока не заполнено всё, на главной работает герой по данным: ${fallback}.`}
        </Alert>
      )}

      <Panel title="Картинка" hint="Полотно 1600×540 на месте акцентной плашки. В центре пунктира — то, что видно на телефоне: по краям кадр срежется почти на треть.">
        <ImageField
          label="Полотно"
          slot="home-banner"
          preview="wide"
          value={draft.image}
          onChange={(path) => set("image", path)}
        />
      </Panel>

      <Panel title="Текст" hint="Заголовок и подпись стоят под полотном. Длиннее предела ряд главной не держит, поэтому поля перестают печатать.">
        <div className="space-y-5">
          <Field
            label="Заголовок"
            hint="Наружу лига называется SPIRIT/CTRL"
            counter={{ len: len(draft.title), max: BANNER_LIMITS.title }}
          >
            {(id, describedBy) => (
              <FormInput
                id={id}
                aria-describedby={describedBy}
                maxLength={BANNER_LIMITS.title}
                value={draft.title ?? ""}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Финал сезона — 20 сентября"
              />
            )}
          </Field>

          <Field label="Подпись" counter={{ len: len(draft.text), max: BANNER_LIMITS.text }}>
            {(id, describedBy) => (
              <FormTextarea
                id={id}
                aria-describedby={describedBy}
                rows={3}
                maxLength={BANNER_LIMITS.text}
                value={draft.text ?? ""}
                onChange={(e) => set("text", e.target.value)}
                placeholder="Одно предложение о том, что происходит и зачем нажимать кнопку."
              />
            )}
          </Field>

          <Field label="Надпись кнопки" counter={{ len: len(draft.ctaLabel), max: BANNER_LIMITS.ctaLabel }}>
            {(id, describedBy) => (
              <FormInput
                id={id}
                aria-describedby={describedBy}
                maxLength={BANNER_LIMITS.ctaLabel}
                value={draft.ctaLabel ?? ""}
                onChange={(e) => set("ctaLabel", e.target.value)}
                placeholder="Смотреть трансляцию"
              />
            )}
          </Field>

          <Field
            label="Адрес кнопки"
            hint={
              draft.ctaHref && isExternalHref(draft.ctaHref)
                ? "Внешняя ссылка — откроется в новой вкладке"
                : "Внутри сайта — путь со слэша («/tournaments/s5/apply»). Наружу — полная ссылка с https://"
            }
          >
            {(id, describedBy) => (
              <FormInput
                id={id}
                aria-describedby={describedBy}
                value={draft.ctaHref ?? ""}
                onChange={(e) => set("ctaHref", e.target.value)}
                placeholder="/tournaments/s5/apply"
              />
            )}
          </Field>
        </div>
      </Panel>

      <Panel title="Показ" hint="Выключенный баннер сохраняет поля: гасить афишу стиранием текста не нужно.">
        <Field label="Показывать баннер на главной">
          {(id) => (
            <Toggle id={id} checked={draft.enabled} onCheckedChange={(v) => set("enabled", v)} />
          )}
        </Field>
      </Panel>

      <SaveButton url="/api/home-banner" data={draft} />
    </div>
  );
}
