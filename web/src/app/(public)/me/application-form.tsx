"use client";

import { useActionState, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { sendApplication, sendClaimWithApplication, saveApplicationDraft, type ApplyState } from "./actions";
import type { LinkablePlayer } from "./linkable-player";
import { TelegramLink } from "./telegram-link";
import {
  EMPTY_INPUT,
  applicationToInput,
  profileLinkKind,
  type Application,
  type ApplicationDraft,
  type ApplicationInput,
} from "@/lib/application";
import { accountIdFromUrl, dotabuffOf, splitFullName } from "@/lib/profiles";
import { ROLES } from "@/lib/roles";
import { Button } from "@/components/pouf/Button";
import { Checkbox } from "@/components/pouf/checkbox";
import { Alert } from "@/components/pouf/feedback";
import { DateField } from "@/components/pouf/date-field";
import { FormInput, FormSelect, Label } from "@/components/pouf/Input";
import { Stepper } from "@/components/pouf/stepper";
import { RowCard } from "@/components/pouf/surface";

// Анкета-заявка: единственное, что видит человек в кабинете до одобрения (требование 6).
// Развилка та же, что в онбординге, но обе ветки заканчиваются не профилем, а заявкой на модерацию:
// «я новый игрок» → анкета JSON, «я уже участник лиги» → заявка на привязку с той же анкетой поверх
// (см. ClaimApplicationForm). Player при новой анкете не заводится (docs/archive/ACCOUNTS-PLAN.md §2.1) —
// иначе неодобренный сразу попал бы в публичный ростер.
//
// С Э8 анкета идёт КВИЗОМ в три шага — по каноническому макету «Вход» (артборды «Шаг 1…3»).
// Двенадцать полей одним полотном в окне входа читались как стена: человек видел объём раньше,
// чем смысл. Шаги те же, что в макете: контакты → профили в Доте → рейтинг и позиция.
//
// Э13: поля обеих веток живут ОДНИМИ компонентами (ContactFields, ProfileStep, RatingStep).
// Раньше они были выписаны дважды и успели разъехаться — правку приходилось делать в двух местах,
// а забытая половина всплывала багом только у той ветки, которую реже открывают.
//
// Про `required`: он работает только на НАСТОЯЩЕМ поле формы. У флажка Кита (radix) нативная
// подложка есть, но она скрыта, и `reportValidity()` на ней возвращает false БЕЗ подсказки —
// кнопка «Далее» просто переставала работать молча. Поэтому согласие с правилами проверяется
// состоянием формы и объясняется текстом рядом с флажком, а выпадающие списки анкеты — нативные
// (`FormSelect`), чтобы браузер показывал претензию у самого поля.

const STEPS = ["Контактная информация", "Киберспортивный профиль", "Рейтинг и позиция"];

/** Страны, между которыми выбирает игрок лиги. Остальное — «Другая» с ручным вводом. */
const COUNTRIES = ["Россия", "Беларусь", "Казахстан", "Украина"];
const OTHER_COUNTRY = "__other";

/** Подписи площадок — ими называется ссылка «открыть профиль» под полем. */
const LINK_LABELS: Record<"dotabuff" | "stratz" | "steam", string> = {
  dotabuff: "Dotabuff",
  stratz: "Stratz",
  steam: "Steam",
};

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  /** Звёздочка у подписи. Метка о самом поле, а не о текущем шаге: обязательность не мигает. */
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && (
          <span aria-hidden className="ml-1 text-[var(--color-err-ink)]">
            *
          </span>
        )}
      </Label>
      {children}
      {hint && <p className="text-[13px] font-bold leading-[1.45] text-muted">{hint}</p>}
    </div>
  );
}

/**
 * Согласие с правилами — обязательное условие отправки (требование 7).
 *
 * Состояние живёт в форме, а не здесь: до Э13 флажок держал его сам и полагался на `required`,
 * который на кнопке-флажке radix не показывает ничего (см. шапку файла). Сервер согласие
 * всё равно перепроверяет — форму можно обойти.
 */
function PolicyCheck({
  accepted,
  onChange,
  invalid,
}: {
  accepted: boolean;
  onChange: (value: boolean) => void;
  /** Человек нажал «Далее», не приняв правила — объясняем, почему шаг не сменился. */
  invalid: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      {/* Подпись — соседний <label for>, а не обёртка: флажок Кита это <button>, а он лейблу
          подчиняется только по `for` (button — labelable-элемент). Обёрткой клик по тексту
          дотягивался бы до скрытого input'а radix и рассинхронизировал бы вид с состоянием. */}
      <div className="flex items-start gap-2.5 rounded-control bg-surface-2 px-4 py-3 cushion-field">
        <Checkbox id={id} name="policy" checked={accepted} onCheckedChange={(v) => onChange(v === true)} />
        <label htmlFor={id} className="text-[13px] font-bold leading-[1.5] text-muted">
          Я прочитал и принимаю{" "}
          <Link href="/rules" target="_blank" className="font-black text-[var(--accent-ink)] underline-offset-4 hover:underline">
            правила лиги
          </Link>
          .
          <span aria-hidden className="ml-1 text-[var(--color-err-ink)]">
            *
          </span>
        </label>
      </div>
      {invalid && (
        <p role="alert" className="text-[13px] font-extrabold text-[var(--color-err-ink)]">
          Без согласия с правилами заявку не отправить — отметьте флажок.
        </p>
      )}
    </div>
  );
}

/**
 * Страна — списком, а не свободной строкой: в ростере из-за ручного ввода одна страна писалась
 * пятью способами («РБ», «Беларусь», «by»), и фильтры по ней не складывались. Редкий случай
 * закрывает «Другая» с ручным вводом.
 */
function CountryField({ defaultValue, required }: { defaultValue: string; required: boolean }) {
  const initial = defaultValue.trim();
  const known = COUNTRIES.includes(initial);
  const [choice, setChoice] = useState(initial ? (known ? initial : OTHER_COUNTRY) : "");
  const [other, setOther] = useState(known ? "" : initial);
  const custom = choice === OTHER_COUNTRY;

  return (
    <div className="space-y-2">
      {/* Сам список без `name`: значение уезжает соседним полем — так «Другая» и выбор из списка
          кладут в FormData одно и то же имя, а сервер не знает про эту развилку вовсе. */}
      <FormSelect
        aria-label="Страна"
        value={choice}
        required={required}
        onChange={(e) => setChoice(e.target.value)}
      >
        <option value="">не выбрана</option>
        {COUNTRIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value={OTHER_COUNTRY}>Другая</option>
      </FormSelect>
      {custom ? (
        <FormInput
          name="country"
          value={other}
          onChange={(e) => setOther(e.target.value)}
          required={required}
          placeholder="Впишите страну"
        />
      ) : (
        <input type="hidden" name="country" value={choice} />
      )}
    </div>
  );
}

/**
 * Телеграм: подтверждение через бота вместо хендла руками (Э19).
 *
 * Хендл, вписанный в поле, не проверяет никто — опечатка равна потерянному контакту, а лига узнаёт
 * об этом ровно тогда, когда человеку надо срочно написать. Кнопка уводит в бота с одноразовым
 * токеном; вернувшись, страница подставляет хендл сама. Ручной ввод остаётся запасным путём —
 * как ссылка на профиль рядом со Steam на шаге 2.
 */
function TelegramField({
  v,
  required,
  verified,
  available,
  onLeave,
}: {
  v: ApplicationInput;
  required: boolean;
  /** Хендл, подтверждённый привязкой (`UserAccount.tgUsername`), либо null. */
  verified: string | null;
  /** Заведён ли бот в окружении: без него кнопки нет вовсе, как у Steam без ключа. */
  available: boolean;
  /** Отложить черновик перед уходом в бота. */
  onLeave: () => void;
}) {
  const [handle, setHandle] = useState(v.telegram || verified || "");
  const norm = (s: string) => s.trim().replace(/^@/, "").toLowerCase();
  // «Подтверждено» — не про факт привязки, а про то, что в поле стоит ИМЕННО подтверждённый хендл:
  // править его руками мы разрешаем, и за поправленный бот уже не ручается. Тот же приём, что у Steam.
  const confirmed = !!verified && norm(handle) === norm(verified);

  return (
    <>
      {available && (
        <TelegramLink
          linked={confirmed}
          username={verified}
          back="/me"
          beforeOpen={onLeave}
          okText="Телеграм подтверждён через бота — хендл подставили сами."
        />
      )}
      <Field
        label="Telegram"
        required
        hint={
          confirmed
            ? "Подставлен по вашей привязке. Нужен другой — впишите руками."
            : "Можно с @ или ссылкой — приведём к хендлу."
        }
      >
        <FormInput
          name="telegram"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          required={required}
          placeholder="@nickname"
        />
      </Field>
    </>
  );
}

/** Общие поля первого шага. Ник спрашивается по-разному (ввод или поиск в ростере), он снаружи. */
function ContactFields({
  v,
  required,
  telegramVerified,
  telegramAvailable,
  onTelegram,
}: {
  v: ApplicationInput;
  required: boolean;
  telegramVerified: string | null;
  telegramAvailable: boolean;
  onTelegram: () => void;
}) {
  return (
    <>
      <Field label="Имя" required>
        <FormInput name="realName" defaultValue={v.realName} required={required} placeholder="Как вас зовут" />
      </Field>

      <Field label="Фамилия" required>
        <FormInput name="realSurname" defaultValue={v.realSurname} required={required} />
      </Field>

      <Field label="Дата рождения" required>
        <DateField name="birthday" defaultValue={v.birthday} required={required} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Город" required>
          <FormInput name="city" defaultValue={v.city} required={required} />
        </Field>
        <Field label="Страна" required>
          <CountryField defaultValue={v.country} required={required} />
        </Field>
      </div>

      <TelegramField
        v={v}
        required={required}
        verified={telegramVerified}
        available={telegramAvailable}
        onLeave={onTelegram}
      />

      {/* Телефон необязателен: организатор пишет в телеграм, а обязательный номер отсекал тех,
          кто его не даёт (до Э13 весь шаг был помечен обязательным скопом). */}
      <Field label="Телефон">
        <FormInput name="phone" type="tel" defaultValue={v.phone} placeholder="+7 900 000-00-00" />
      </Field>
    </>
  );
}

/**
 * Второй шаг: ссылка ОДНА и обязательная. Раньше здесь стояли три поля, все необязательные: шаг
 * пролистывался насквозь, а отказ прилетал уже на отправке анкеты. Из любой из трёх выводится
 * account_id, а из него — два остальных адреса (`playerLinks`), так что спрашивать три было
 * тремя способами спросить одно.
 *
 * Э15: первым делом предлагаем подтвердить профиль через Steam. Steam называет steamid64 сам —
 * ошибиться в нём негде, а ручная ссылка остаётся запасным путём для тех, кому в Steam не войти.
 * Кнопки «Найти себя на Dotabuff» здесь больше нет: она искала по ЛИГОВОМУ нику с первого шага,
 * а в паблике ник обычно другой — поиск чаще промахивался, чем помогал.
 */
function ProfileStep({
  v,
  required,
  steamAccountId,
  steamAvailable,
  onSteam,
}: {
  v: ApplicationInput;
  required: boolean;
  /** account_id, выведенный из привязанного Steam, либо null — Steam к аккаунту не привязан. */
  steamAccountId: string | null;
  /** Настроен ли вход через Steam на сервере: без ключа кнопки нет вовсе, как и на входе в кабинет. */
  steamAvailable: boolean;
  onSteam: () => void;
}) {
  // Подтверждённый Steam подставляет адрес сам; уже заполненное (черновик, карточка ростера) не трогаем.
  const [url, setUrl] = useState(v.profileUrl || (steamAccountId ? dotabuffOf(steamAccountId) : ""));
  const kind = profileLinkKind(url);
  const href = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;
  // «Подтверждено» — не про факт привязки, а про то, что в поле стоит ИМЕННО подтверждённый аккаунт:
  // править ссылку руками мы разрешаем, и за поправленную Steam уже не ручается.
  const confirmed = steamAccountId != null && accountIdFromUrl(url) === steamAccountId;

  return (
    <>
      {confirmed ? (
        <Alert tone="ok" block>
          Профиль подтверждён через Steam — адрес подставили сами.
        </Alert>
      ) : steamAvailable ? (
        <div className="space-y-2">
          <Button type="button" size="lg" block onClick={onSteam}>
            Подтвердить через Steam
          </Button>
          <p className="text-[13px] font-bold leading-[1.45] text-muted">
            Steam назовёт ваш профиль сам — искать адрес не придётся. Ответы анкеты сохранятся, вы вернётесь сюда же.
          </p>
        </div>
      ) : null}

      <Field
        label="Ссылка на профиль"
        required
        hint={
          confirmed
            ? "Подставлена по вашему Steam. Подтвердили не тот аккаунт — поправьте ссылку руками."
            : steamAvailable
              ? "Нет доступа к Steam? Вставьте ссылку руками: Dotabuff, Stratz или Steam — любая, остальные адреса достроим сами."
              : "Dotabuff, Stratz или Steam — любая. По ней лига находит вас в матчах, остальные адреса достроим сами."
        }
      >
        <FormInput
          name="profileUrl"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required={required}
          placeholder="https://www.dotabuff.com/players/…"
        />
      </Field>

      {/* Разобранную ссылку сразу даём открыть: и человек сверяет «я ли это», особенно когда
          адрес подтянулся из ростера, и опечатка в номере видна до отправки анкеты. */}
      {kind && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-[13px] font-black text-[var(--accent-ink)] underline-offset-4 hover:underline"
        >
          Открыть профиль на {LINK_LABELS[kind]} ↗ — проверьте, что это вы
        </a>
      )}
    </>
  );
}

/** Третий шаг: заявленный рейтинг и позиция. */
function RatingStep({ v, required }: { v: ApplicationInput; required: boolean }) {
  return (
    <>
      <Field label="MMR" required hint="Со слов игрока — проверит организатор.">
        <FormInput name="mmr" inputMode="numeric" defaultValue={v.mmr} required={required} placeholder="Например, 4200" />
      </Field>

      <Field label="Позиция" required>
        {/* Нативный список, а не radix: у radix значение живёт в состоянии, а нативная подложка
            скрыта — обязательность на ней превращалась в непоказанную ошибку, и незаполненную
            позицию ловил только сервер, уже после всей анкеты. */}
        <FormSelect name="position" defaultValue={v.position} required={required} aria-label="Позиция">
          <option value="">не выбрана</option>
          {ROLES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.position ? `${r.position} — ${r.short}` : r.short}
            </option>
          ))}
        </FormSelect>
      </Field>
    </>
  );
}

/** Кнопки шага — одни на обе ветки: «Назад» слева, «Далее»/«Отправить» широкой кнопкой. */
function StepNav({
  step,
  pending,
  onBack,
  onNext,
  blocked,
  submitLabel,
}: {
  step: number;
  pending: boolean;
  onBack: () => void;
  onNext: () => void;
  /** Ветка привязки: пока себя не нашли, идти некуда. */
  blocked?: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex gap-3">
      {step > 0 && (
        <Button type="button" variant="quiet" size="lg" onClick={onBack}>
          Назад
        </Button>
      )}
      {step < STEPS.length - 1 ? (
        <Button type="button" size="lg" onClick={onNext} disabled={step === 0 && blocked} className="flex-1">
          Далее
        </Button>
      ) : (
        <Button type="submit" loading={pending} disabled={blocked} size="lg" className="flex-1">
          {pending ? "Отправляю…" : submitLabel}
        </Button>
      )}
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

/**
 * Отдать серверу состояние квиза (Э14). Зовётся при переходе вперёд по шагу: до этого ответы жили
 * только между двумя submit'ами одной страницы, и закрытая вкладка стирала всё.
 *
 * Ответа не ждём и ошибку глотаем: черновик — удобство, а не условие шага; упавшая запись не должна
 * запирать человека на текущем экране. Шаг кладём в ту же FormData — сервер разбирает её тем же
 * `readApplicationInput`, что и отправку.
 */
function saveStepDraft(form: HTMLFormElement | null, step: number): Promise<void> {
  if (!form) return Promise.resolve();
  const data = new FormData(form);
  data.set("step", String(step));
  return saveApplicationDraft(data).catch(() => {});
}

/**
 * Уйти на подтверждение через Steam (Э15). Уход на steamcommunity.com — это уход СО СТРАНИЦЫ
 * посреди шага 2, поэтому черновик кладём до перехода и дожидаемся записи: иначе Steam съел бы
 * ответы ровно так, как это чинил Э14. Номер шага — текущий, чтобы вернуться на этот же экран.
 */
function leaveForSteam(form: HTMLFormElement | null, step: number) {
  void saveStepDraft(form, step).then(() => {
    window.location.href = "/api/auth/steam/start";
  });
}

/** Черновик мог прийти с шагом от другой версии формы — за границы квиза его не пускаем. */
const draftStep = (draft: ApplicationDraft | null): number =>
  draft ? Math.min(Math.max(draft.step, 0), STEPS.length - 1) : 0;

/** Легенда к звёздочкам — иначе метка обязательности читается как случайный символ. */
const REQUIRED_HINT = (
  <p className="text-[13px] font-bold leading-[1.45] text-muted">
    Поля со звёздочкой <span className="text-[var(--color-err-ink)]">*</span> обязательны, остальные — по желанию.
  </p>
);

export function ApplicationFlow({
  application,
  draft,
  players,
  steamAccountId,
  steamAvailable,
  telegramVerified,
  telegramAvailable,
  rejectedReason,
  rejectedAt,
}: {
  application: Application | null;
  /** Незаконченный квиз с прошлого захода (Э14): им же выбирается ветка, в которую вернуть человека. */
  draft: ApplicationDraft | null;
  players: LinkablePlayer[];
  /** Подтверждённый через Steam account_id аккаунта, либо null. Обе ветки квиза берут его на шаге 2. */
  steamAccountId: string | null;
  steamAvailable: boolean;
  /** Хендл, подтверждённый привязкой телеграма (Э19), либо null: шаг 1 подставляет его сам. */
  telegramVerified: string | null;
  /** Заведён ли бот в окружении — без него кнопки привязки нет вовсе. */
  telegramAvailable: boolean;
  rejectedReason: string | null;
  /** Дата решения, уже отформатированная на сервере (клиент в другом поясе показал бы своё время). */
  rejectedAt: string | null;
}) {
  // Если анкету уже присылали (её вернули на доработку) или квиз брошен на середине — сразу открываем
  // форму с прежними ответами: заставлять человека второй раз проходить развилку незачем. Ветку
  // черновика узнаём по найденному игроку: он бывает только у «я уже участник лиги».
  const [mode, setMode] = useState<"pick" | "new" | "existing">(
    draft ? (draft.playerId ? "existing" : "new") : application ? "new" : "pick",
  );

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
              title="Я уже участник лиги"
              hint="Найти себя по нику — остальное подтянем из ростера."
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
            <ApplicationForm
              application={application}
              draft={draft?.playerId ? null : draft}
              steamAccountId={steamAccountId}
              steamAvailable={steamAvailable}
              telegramVerified={telegramVerified}
              telegramAvailable={telegramAvailable}
            />
          ) : (
            <ClaimApplicationForm
              players={players}
              draft={draft?.playerId ? draft : null}
              steamAccountId={steamAccountId}
              steamAvailable={steamAvailable}
              telegramVerified={telegramVerified}
              telegramAvailable={telegramAvailable}
            />
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
function ApplicationForm({
  application,
  draft,
  steamAccountId,
  steamAvailable,
  telegramVerified,
  telegramAvailable,
}: {
  application: Application | null;
  draft: ApplicationDraft | null;
  steamAccountId: string | null;
  steamAvailable: boolean;
  telegramVerified: string | null;
  telegramAvailable: boolean;
}) {
  const [state, action, pending] = useActionState<ApplyState, FormData>(sendApplication, null);
  const [step, setStep] = useState(() => draftStep(draft));
  const [policy, setPolicy] = useState(draft?.policy ?? false);
  const [policyMissed, setPolicyMissed] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Порядок источников важен. После submit React возвращает неуправляемые поля к defaultValue,
  // поэтому ответы приходят обратно в состоянии (иначе ошибка в одной строке стирала бы всю анкету) —
  // и свежая правка обязана перекрыть черновик прошлого захода, а тот — уже отправленную анкету.
  const v = state?.values ?? draft?.values ?? (application ? applicationToInput(application) : EMPTY_INPUT);

  /** Шаг вперёд — только если довольны и браузер (поля шага), и мы (согласие с правилами). */
  const next = () => {
    if (formRef.current?.reportValidity() === false) return;
    if (step === 0 && !policy) {
      setPolicyMissed(true);
      return;
    }
    const to = Math.min(step + 1, STEPS.length - 1);
    saveStepDraft(formRef.current, to);
    setStep(to);
  };

  const req = (n: number) => step === n;

  return (
    <form ref={formRef} action={action} className="space-y-5">
      <Stepper steps={STEPS} current={step} />
      {REQUIRED_HINT}

      <div hidden={step !== 0} className="space-y-4">
        <Field label="Ник в лиге" required hint="Под ним вас увидят в таблицах и на витрине.">
          <FormInput name="nickname" defaultValue={v.nickname} required={req(0)} placeholder="Например, Miracle-" />
        </Field>

        <ContactFields
          v={v}
          required={req(0)}
          telegramVerified={telegramVerified}
          telegramAvailable={telegramAvailable}
          onTelegram={() => void saveStepDraft(formRef.current, step)}
        />

        <PolicyCheck
          accepted={policy}
          invalid={policyMissed && !policy}
          onChange={(value) => {
            setPolicy(value);
            if (value) setPolicyMissed(false);
          }}
        />
      </div>

      <div hidden={step !== 1} className="space-y-4">
        <ProfileStep
          v={v}
          required={req(1)}
          steamAccountId={steamAccountId}
          steamAvailable={steamAvailable}
          onSteam={() => leaveForSteam(formRef.current, step)}
        />
      </div>

      <div hidden={step !== 2} className="space-y-4">
        <RatingStep v={v} required={req(2)} />
      </div>

      <StepNav
        step={step}
        pending={pending}
        onBack={() => setStep((s) => s - 1)}
        onNext={next}
        submitLabel="Отправить анкету"
      />

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

/** Найденный в ростере игрок → значения квиза: что известно, то не переспрашиваем. */
function inputFromPlayer(player: LinkablePlayer, fallbackNickname: string): ApplicationInput {
  // В старых карточках ростера «Имя Фамилия» лежит целиком в realName (в таблицах составов колонка
  // одна). Импорт теперь раскладывает их по двум полям (lib/roster-import.ts), но уже заведённые
  // профили этого не знают — поэтому здесь подстраховка: фамилии нет, значит она внутри имени.
  const name = player.realSurname
    ? { realName: player.realName ?? "", realSurname: player.realSurname }
    : splitFullName(player.realName);

  return {
    nickname: player.nickname || fallbackNickname,
    realName: name.realName,
    realSurname: name.realSurname,
    birthday: player.birthday ? new Date(player.birthday).toISOString().slice(0, 10) : "",
    city: player.city ?? "",
    country: player.country ?? "",
    profileUrl: player.dotabuffUrl || player.stratzUrl || player.steamUrl || "",
    telegram: player.telegram ?? "",
    phone: player.phone ?? "",
    position: "",
    mmr: player.mmr != null ? String(player.mmr) : "",
  };
}

/**
 * Ветка «я уже участник лиги»: поиск себя по нику вместо анкеты нового игрока — тот же квиз
 * из трёх шагов, но найденный профиль подтягивает известные поля, а незаполненные (обычно
 * ссылка на профиль, MMR, позиция) ждут ответа, как и в анкете нового игрока.
 */
function ClaimApplicationForm({
  players,
  draft,
  steamAccountId,
  steamAvailable,
  telegramVerified,
  telegramAvailable,
}: {
  players: LinkablePlayer[];
  draft: ApplicationDraft | null;
  steamAccountId: string | null;
  steamAvailable: boolean;
  telegramVerified: string | null;
  telegramAvailable: boolean;
}) {
  const [state, action, pending] = useActionState<ApplyState, FormData>(sendClaimWithApplication, null);
  const [step, setStep] = useState(() => draftStep(draft));
  const [query, setQuery] = useState(draft?.values.nickname ?? "");
  // Найденного в ростере игрока черновик хранит id'шником — иначе поиск себя проходился бы заново.
  // Игрока могли и убрать из ростера, тогда возвращаемся к поиску: id без карточки нам не поможет.
  const [picked, setPicked] = useState<LinkablePlayer | null>(
    () => players.find((p) => p.id === draft?.playerId) ?? null,
  );
  // Пока человек не тронул поиск, поля показывают черновик; выбрал другого игрока — подтягиваем
  // его карточку, черновик прошлого захода к ней уже не относится.
  const [fromDraft, setFromDraft] = useState(draft != null);
  const [policy, setPolicy] = useState(draft?.policy ?? false);
  const [policyMissed, setPolicyMissed] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || picked) return [];
    return players.filter((p) => p.nickname.toLowerCase().includes(q)).slice(0, 6);
  }, [players, query, picked]);

  // После ошибки сервер возвращает введённое обратно (values); следом идёт брошенный на середине
  // квиз, и только потом карточка найденного игрока — при первом рендере (никого ещё не нашли)
  // это просто пустая анкета с нашим ником.
  const v =
    state?.values ??
    (fromDraft && draft ? draft.values : picked ? inputFromPlayer(picked, query) : { ...EMPTY_INPUT, nickname: query });

  const next = () => {
    if (formRef.current?.reportValidity() === false) return;
    if (step === 0 && !policy) {
      setPolicyMissed(true);
      return;
    }
    const to = Math.min(step + 1, STEPS.length - 1);
    saveStepDraft(formRef.current, to);
    setStep(to);
  };
  const req = (n: number) => step === n;

  return (
    <form ref={formRef} action={action} className="space-y-5">
      <input type="hidden" name="playerId" value={picked?.id ?? ""} />
      <Stepper steps={STEPS} current={step} />
      {REQUIRED_HINT}

      <div hidden={step !== 0} className="space-y-4">
        <Field label="Ваш ник в ростере" required hint="Начните вводить — как найдётесь в списке, остальное подтянем сами.">
          <FormInput
            name="nickname"
            value={picked ? picked.nickname : query}
            onChange={(e) => {
              setPicked(null);
              setFromDraft(false);
              setQuery(e.target.value);
            }}
            autoFocus
            required={req(0)}
            placeholder="Например, Miracle-"
          />
        </Field>

        {!picked && matches.length > 0 && (
          <ul className="space-y-1.5">
            {matches.map((p) => (
              <li key={p.id}>
                <RowCard onClick={() => setPicked(p)}>
                  <span className="text-sm font-black text-ink">{p.nickname}</span>
                </RowCard>
              </li>
            ))}
          </ul>
        )}
        {!picked && query.trim() && matches.length === 0 && (
          <p className="text-[13px] font-bold leading-[1.45] text-muted">
            Никого не нашли. Возможно, вас ещё нет в ростере — тогда это анкета нового игрока.
          </p>
        )}
        {picked && (
          <Alert tone="ok" block>
            Нашли вас в ростере — известные поля подтянули, доскажите то, чего не хватает.
          </Alert>
        )}

        {/* Ключ на игроке — при смене найденного профиля неуправляемые поля должны перечитать
            новый defaultValue, а не остаться со значениями прошлого совпадения. */}
        <div key={picked?.id ?? "new"} className="space-y-4">
          <ContactFields
            v={v}
            required={req(0)}
            telegramVerified={telegramVerified}
            telegramAvailable={telegramAvailable}
            onTelegram={() => void saveStepDraft(formRef.current, step)}
          />
        </div>

        <PolicyCheck
          accepted={policy}
          invalid={policyMissed && !policy}
          onChange={(value) => {
            setPolicy(value);
            if (value) setPolicyMissed(false);
          }}
        />
      </div>

      <div hidden={step !== 1} className="space-y-4" key={`profile-${picked?.id ?? "new"}`}>
        <ProfileStep
          v={v}
          required={req(1)}
          steamAccountId={steamAccountId}
          steamAvailable={steamAvailable}
          onSteam={() => leaveForSteam(formRef.current, step)}
        />
      </div>

      <div hidden={step !== 2} className="space-y-4" key={`rating-${picked?.id ?? "new"}`}>
        <RatingStep v={v} required={req(2)} />
      </div>

      <StepNav
        step={step}
        pending={pending}
        onBack={() => setStep((s) => s - 1)}
        onNext={next}
        blocked={!picked}
        submitLabel="Отправить заявку"
      />

      {state?.error && (
        <Alert tone="err" block>
          {state.error}
        </Alert>
      )}
    </form>
  );
}
