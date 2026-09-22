"use client";

import { useState } from "react";
import { Field } from "@/components/pouf/Input";
import { StatusPill } from "@/components/pouf/feedback";
import { Separator } from "@/components/pouf/separator";
import { Toggle } from "@/components/pouf/toggle";
import { SaveButton } from "@/app/_components/form";
import { Panel } from "../../../_components/panel";

// Форма показа: два тумблера и одна кнопка, как у баннера. Сохранение явной кнопкой, а не сразу
// по переключению: уклад служебных экранов один, и исход записи (`Alert` ok/err из `SaveButton`)
// показывается там же, где у остальных.
//
// Состояние обязано читаться словом, а не только положением бегунка: у выключенного `disabled`
// тумблера дорожка приглушена, и «серое выключено» от «серого выключено без прав» глазом не
// отличается (WCAG 2.2 SC 1.4.1).

type Draft = { telegram: boolean; mmr: boolean };

/** Состояние показа словом — рядом с каждым тумблером. */
const Shown = ({ on }: { on: boolean }) =>
  on ? <StatusPill tone="info">Показывается</StatusPill> : <StatusPill>Скрыто</StatusPill>;

function Row({
  label,
  hint,
  on,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <div className="flex flex-wrap items-center gap-3 py-1">
          <Toggle id={id} checked={on} disabled={disabled} onCheckedChange={onChange} />
          <Shown on={on} />
        </div>
      )}
    </Field>
  );
}

export function PrivacyAdmin({ initial, canEdit }: { initial: Draft; canEdit: boolean }) {
  const [draft, setDraft] = useState(initial);
  const dirty = draft.telegram !== initial.telegram || draft.mmr !== initial.mmr;

  return (
    <div className="space-y-4">
      <Panel
        title="Что видно посетителю"
        hint="По умолчанию оба показа выключены: пустая база и свежая выкатка открывают лигу закрытой."
      >
        <Row
          label="Показывать телеграм игроков"
          hint="Выключено — пилюля @handle пропадает со страницы игрока, из витрин ростера и из ответов бота о чужом профиле. Хендл продолжает собираться анкетой и виден оператору; свой телеграм игрок видит всегда."
          on={draft.telegram}
          disabled={!canEdit}
          onChange={(v) => setDraft((d) => ({ ...d, telegram: v }))}
        />
        <Separator />
        <Row
          label="Показывать MMR"
          hint="Выключено — вместе с числом пропадают средний MMR команды, полоска силы в составе и Σ MMR на оверлее: это то же число, показанное иначе. Свой MMR игрок видит в /me/profile, оператор — как прежде."
          on={draft.mmr}
          disabled={!canEdit}
          onChange={(v) => setDraft((d) => ({ ...d, mmr: v }))}
        />
      </Panel>

      {/* Кнопки, которая всегда отвечает 403, не рисуем вовсе: её отсутствие честнее отказа. */}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Цена забытого нажатия здесь — «контакты остались открытыми», поэтому черновик,
              разошедшийся с сохранённым, называет себя словом. */}
          {dirty && <StatusPill tone="warn">Не сохранено</StatusPill>}
          <SaveButton url="/api/privacy" data={draft} label="Сохранить показ" />
        </div>
      )}
    </div>
  );
}
