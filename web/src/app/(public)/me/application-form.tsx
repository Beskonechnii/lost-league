"use client";

import { useActionState, useId, useRef, useState } from "react";
import Link from "next/link";
import { sendApplication, sendClaim, type ApplyState } from "./actions";
import { PlayerPicker, type LinkablePlayer } from "./onboarding";
import { EMPTY_INPUT, applicationToInput, type Application } from "@/lib/application";
import { ROLES } from "@/lib/roles";
import { Button, buttonClasses } from "@/components/pouf/Button";
import { Checkbox } from "@/components/pouf/checkbox";
import { Alert } from "@/components/pouf/feedback";
import { DateField } from "@/components/pouf/date-field";
import { FormInput, Label } from "@/components/pouf/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/pouf/select";
import { Stepper } from "@/components/pouf/stepper";
import { RowCard } from "@/components/pouf/surface";

// Анкета-заявка: единственное, что видит человек в кабинете до одобрения (требование 6).
// Развилка та же, что в онбординге, но обе ветки заканчиваются не профилем, а заявкой на модерацию:
// «я новый игрок» → анкета JSON, «я уже в ростере» → заявка на привязку. Player при этом не заводится
// (docs/archive/ACCOUNTS-PLAN.md §2.1) — иначе неодобренный сразу попал бы в публичный ростер.
//
// С Э8 анкета идёт КВИЗОМ в три шага — по каноническому макету «Вход» (артборды «Шаг 1…3»).
// Двенадцать полей одним полотном в окне входа читались как стена: человек видел объём раньше,
// чем смысл. Шаги те же, что в макете: контакты → профили в Доте → рейтинг и позиция.

const STEPS = ["Контактная информация", "Киберспортивный профиль", "Рейтинг и позиция"];

function Field({
  label,
  hint,
  optional,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  /** Единственная пометка в анкете: обязательно всё, кроме отмеченного. */
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {optional && <span className="ml-1 font-bold normal-case tracking-normal text-muted">— необязательно</span>}
      </Label>
      {children}
      {hint && <p className="text-[13px] font-bold leading-[1.45] text-muted">{hint}</p>}
    </div>
  );
}

/** Согласие с правилами — обязательное условие отправки (требование 7). Сервер его перепроверяет. */
function PolicyCheck({ required = true }: { required?: boolean }) {
  const [on, setOn] = useState(false);
  const id = useId();
  return (
    // Подпись — соседний <label for>, а не обёртка: флажок Кита это <button>, а он лейблу
    // подчиняется только по `for` (button — labelable-элемент). Обёрткой клик по тексту
    // дотягивался бы до скрытого input'а radix и рассинхронизировал бы вид с состоянием.
    <div className="flex items-start gap-2.5 rounded-control bg-surface-2 px-4 py-3 cushion-field">
      <Checkbox id={id} name="policy" checked={on} onCheckedChange={(v) => setOn(v === true)} required={required} />
      <label htmlFor={id} className="text-[13px] font-bold leading-[1.5] text-muted">
        Я прочитал и принимаю{" "}
        <Link href="/rules" target="_blank" className="font-black text-[var(--accent-ink)] underline-offset-4 hover:underline">
          правила лиги
        </Link>
        .
      </label>
    </div>
  );
}

/** Развилка «кто вы» — два равных пути, поэтому строками-подушками Кита, а не кнопками. */
function ForkCard({ title, hint, onClick }: { title: string; hint: string; onClick: () => void }) {
  return (
    <RowCard onClick={onClick}>
      <span className="block text-[15px] font-black text-ink">{title}</span>
      <span className="mt-0.5 block text-[13px] font-bold leading-[1.45] text-muted">{hint}</span>
    </RowCard>
  );
}

export function ApplicationFlow({
  application,
  players,
  rejectedReason,
  rejectedAt,
}: {
  application: Application | null;
  players: LinkablePlayer[];
  rejectedReason: string | null;
  /** Дата решения, уже отформатированная на сервере (клиент в другом поясе показал бы своё время). */
  rejectedAt: string | null;
}) {
  // Если анкету уже присылали (её вернули на доработку) — сразу открываем форму с прежними ответами:
  // заставлять человека второй раз проходить развилку незачем.
  const [mode, setMode] = useState<"pick" | "new" | "existing">(application ? "new" : "pick");

  return (
    <div className="space-y-4">
      {rejectedReason && (
        <div className="space-y-2">
          <Alert tone="err" block>
            Заявку вернули. <span className="whitespace-pre-line font-bold">{rejectedReason}</span>
          </Alert>
          {/* Причина — не приговор, а список правок: ниже сразу открыта та же анкета с прежними
              ответами, поправить нужное и отправить снова. */}
          <p className="text-[13px] font-bold leading-[1.5] text-muted">
            {rejectedAt ? `Решение от ${rejectedAt}. ` : ""}
            Поправьте {application ? "анкету" : "заявку"} ниже и отправьте снова — она вернётся в очередь.
          </p>
        </div>
      )}

      {mode === "pick" ? (
        <>
          <div>
            <p className="text-[15px] font-black text-ink">Заявка на вступление</p>
            <p className="mt-1 text-[13px] font-bold leading-[1.5] text-muted">
              Регистрация — ещё не приём в лигу: заполните анкету, её посмотрит организатор. Кто вы?
            </p>
          </div>
          <div className="grid gap-2">
            <ForkCard
              title="Я уже в ростере"
              hint="Найти себя и подать заявку на привязку профиля."
              onClick={() => setMode("existing")}
            />
            <ForkCard
              title="Я новый игрок"
              hint="Заполнить анкету — это заявка в лигу."
              onClick={() => setMode("new")}
            />
          </div>
        </>
      ) : (
        <>
          <button
            onClick={() => setMode("pick")}
            className="text-[13px] font-black text-muted transition-colors hover:text-ink"
          >
            ← назад
          </button>
          {mode === "new" ? (
            <ApplicationForm application={application} />
          ) : (
            <ClaimApplicationForm players={players} />
          )}
        </>
      )}
    </div>
  );
}

/**
 * Анкета нового игрока квизом в три шага.
 *
 * Поля всех шагов остаются в DOM (скрытые — под `hidden`): форма одна, и FormData обязана уехать
 * целиком, иначе шаг 1 стирался бы при переходе на шаг 2. А `required` висит только на полях
 * ТЕКУЩЕГО шага — иначе браузер отказывался бы отправлять форму из-за невидимого обязательного
 * поля («An invalid form control is not focusable») и молчал бы об этом.
 */
function ApplicationForm({ application }: { application: Application | null }) {
  const [state, action, pending] = useActionState<ApplyState, FormData>(sendApplication, null);
  const [step, setStep] = useState(0);
  const [position, setPosition] = useState(application?.position ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  // После submit React возвращает неуправляемые поля к defaultValue, поэтому «черновик» ответов
  // приходит обратно в состоянии: иначе ошибка в одной строке стирала бы всю анкету.
  const v = state?.values ?? (application ? applicationToInput(application) : EMPTY_INPUT);

  /** Шаг вперёд — только если браузер доволен полями текущего шага (на остальных required нет). */
  const next = () => {
    if (formRef.current?.reportValidity() === false) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const req = (n: number) => step === n;

  /** Открыть поиск Dotabuff по нику из первого шага: адрес профиля человек чаще всего не помнит. */
  const searchDotabuff = () => {
    const nick = new FormData(formRef.current!).get("nickname");
    const q = typeof nick === "string" ? nick.trim() : "";
    window.open(`https://www.dotabuff.com/search?q=${encodeURIComponent(q)}`, "_blank", "noopener");
  };

  return (
    <form ref={formRef} action={action} className="space-y-5">
      <Stepper steps={STEPS} current={step} />

      <div hidden={step !== 0} className="space-y-4">
        <Field label="Ник в лиге" hint="Под ним вас увидят в таблицах и на витрине.">
          <FormInput name="nickname" defaultValue={v.nickname} required={req(0)} placeholder="Например, Miracle-" />
        </Field>

        <Field label="Имя">
          <FormInput name="realName" defaultValue={v.realName} required={req(0)} placeholder="Как вас зовут" />
        </Field>

        <Field label="Дата рождения">
          <DateField name="birthday" defaultValue={v.birthday} required={req(0)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Город">
            <FormInput name="city" defaultValue={v.city} required={req(0)} />
          </Field>
          <Field label="Страна">
            <FormInput name="country" defaultValue={v.country} required={req(0)} />
          </Field>
        </div>

        <Field label="Telegram" hint="Можно с @ или ссылкой — приведём к хендлу.">
          <FormInput name="telegram" defaultValue={v.telegram} required={req(0)} placeholder="@nickname" />
        </Field>

        <PolicyCheck required={req(0)} />
      </div>

      <div hidden={step !== 1} className="space-y-4">
        {/* Ссылка ОДНА и обязательная. Раньше здесь стояли три поля, все необязательные: шаг
            пролистывался насквозь, а отказ прилетал уже на отправке анкеты. Из любой из трёх
            выводится account_id, а из него — два остальных адреса (`playerLinks`), так что
            спрашивать три было тремя способами спросить одно. */}
        <Field
          label="Ссылка на профиль"
          hint="Dotabuff, Stratz или Steam — любая. По ней лига находит вас в матчах, остальные адреса достроим сами."
        >
          <FormInput
            name="profileUrl"
            defaultValue={v.profileUrl}
            required={req(1)}
            placeholder="https://www.dotabuff.com/players/…"
          />
        </Field>

        {/* «Найти себя» — чтобы не уходить искать адрес руками: открываем поиск Dotabuff уже
            по нику, введённому на первом шаге. */}
        <button type="button" onClick={searchDotabuff} className={buttonClasses({ variant: "quiet", size: "sm" })}>
          Найти себя на Dotabuff
        </button>
      </div>

      <div hidden={step !== 2} className="space-y-4">
        <Field label="MMR" hint="Со слов игрока — проверит организатор.">
          <FormInput name="mmr" inputMode="numeric" defaultValue={v.mmr} required={req(2)} placeholder="Например, 4200" />
        </Field>

        <Field label="Позиция">
          {/* Селект Кита + скрытое поле: у radix есть своя нативная подложка, но она невидима,
              и обязательность на ней превращалась бы в непоказанную ошибку валидации.
              Пустую позицию ловит сервер (normalizeApplication). */}
          <input type="hidden" name="position" value={position} />
          <Select value={position || undefined} onValueChange={setPosition}>
            <SelectTrigger aria-label="Позиция">
              <SelectValue placeholder="не выбрана" />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r.key} value={r.key}>
                  {r.position ? `${r.position} — ${r.short}` : r.short}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="flex gap-3">
        {step > 0 && (
          <Button type="button" variant="quiet" size="lg" onClick={() => setStep((s) => s - 1)}>
            Назад
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button type="button" size="lg" onClick={next} className="flex-1">
            Далее
          </Button>
        ) : (
          <Button type="submit" loading={pending} size="lg" className="flex-1">
            {pending ? "Отправляю…" : "Отправить анкету"}
          </Button>
        )}
      </div>

      {/* Сервер проверяет анкету целиком, поэтому его претензия может касаться поля с другого
          шага — тогда возвращаем человека туда, где это поле видно, а не оставляем гадать. */}
      {state?.error && (
        <Alert tone="err" block>
          {state.error}
        </Alert>
      )}
    </form>
  );
}

/** Ветка «я уже в ростере»: анкета не нужна — все данные уже в профиле, нужен лишь его выбор. */
function ClaimApplicationForm({ players }: { players: LinkablePlayer[] }) {
  const [state, action, pending] = useActionState<ApplyState, FormData>(sendClaim, null);
  const [picked, setPicked] = useState<LinkablePlayer | null>(null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="playerId" value={picked?.id ?? ""} />
      <PlayerPicker players={players} picked={picked} onPick={setPicked} />
      <PolicyCheck />
      <Button type="submit" disabled={!picked} loading={pending} size="lg" block>
        {pending ? "Отправляю…" : "Подать заявку на привязку"}
      </Button>
      {state?.error && (
        <Alert tone="err" block>
          {state.error}
        </Alert>
      )}
    </form>
  );
}
