"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { sendApplication, sendClaim, type ApplyState } from "./actions";
import { PlayerPicker, type LinkablePlayer } from "./onboarding";
import { EMPTY_INPUT, applicationToInput, type Application } from "@/lib/application";
import { ROLES } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Анкета-заявка: единственное, что видит человек в кабинете до одобрения (требование 6).
// Развилка та же, что в онбординге, но обе ветки заканчиваются не профилем, а заявкой на модерацию:
// «я новый игрок» → анкета JSON, «я уже в ростере» → заявка на привязку. Player при этом не заводится
// (ACCOUNTS-PLAN.md §2.1) — иначе неодобренный сразу попал бы в публичный ростер.

const errorBox = "rounded-md border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300";

function Field({
  label,
  hint,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  /** Единственная пометка в анкете: обязательно всё, кроме отмеченного. */
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label>
        {label}
        {optional && <span className="ml-1 font-normal text-ink-subtle">— необязательно</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}

/** Согласие с политикой — обязательное условие отправки (требование 7). Сервер его перепроверяет. */
function PolicyCheck() {
  return (
    <label className="flex items-start gap-2.5 rounded-md border border-hairline bg-surface-2/40 px-3 py-2.5 text-xs text-ink-muted">
      <input
        type="checkbox"
        name="policy"
        required
        className="mt-0.5 size-4 shrink-0 accent-accent"
      />
      <span>
        Я прочитал и принимаю{" "}
        <Link href="/rules" target="_blank" className="text-accent underline underline-offset-2">
          правила лиги
        </Link>
        .
      </span>
    </label>
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
    <div className="space-y-3">
      {rejectedReason && (
        <div className="rounded-xl border border-rose-900 bg-rose-950/30 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-rose-400/80">Заявку вернули</p>
          {/* Причина — не приговор, а список правок: ниже сразу открыта та же анкета с прежними
              ответами, поправить нужное и отправить снова. */}
          <p className="mt-1 whitespace-pre-line text-sm text-ink">{rejectedReason}</p>
          <p className="mt-2 text-xs text-ink-subtle">
            {rejectedAt ? `Решение от ${rejectedAt}. ` : ""}
            Поправьте {application ? "анкету" : "заявку"} ниже и отправьте снова — она вернётся в очередь.
          </p>
        </div>
      )}

      {mode === "pick" ? (
        <>
          <div>
            <p className="text-sm font-medium text-ink">Заявка на вступление</p>
            <p className="mt-1 text-sm text-ink-muted">
              Регистрация — ещё не приём в лигу: заполните анкету, её посмотрит организатор. Кто вы?
            </p>
          </div>
          <div className="grid gap-2">
            <button
              onClick={() => setMode("existing")}
              className="rounded-lg border border-hairline bg-surface-1 px-4 py-3 text-left transition-colors hover:border-accent"
            >
              <span className="block font-medium">Я уже в ростере</span>
              <span className="mt-0.5 block text-xs text-ink-subtle">
                Найти себя и подать заявку на привязку профиля.
              </span>
            </button>
            <button
              onClick={() => setMode("new")}
              className="rounded-lg border border-hairline bg-surface-1 px-4 py-3 text-left transition-colors hover:border-accent"
            >
              <span className="block font-medium">Я новый игрок</span>
              <span className="mt-0.5 block text-xs text-ink-subtle">Заполнить анкету — это заявка в лигу.</span>
            </button>
          </div>
        </>
      ) : (
        <>
          <button onClick={() => setMode("pick")} className="text-xs text-ink-subtle hover:text-ink">
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

/** Анкета нового игрока. Ссылки — каждая отдельным полем: оператору важно видеть, что именно дали. */
function ApplicationForm({ application }: { application: Application | null }) {
  const [state, action, pending] = useActionState<ApplyState, FormData>(sendApplication, null);
  // После submit React возвращает неуправляемые поля к defaultValue, поэтому «черновик» ответов
  // приходит обратно в состоянии: иначе ошибка в одной строке стирала бы всю анкету.
  const v = state?.values ?? (application ? applicationToInput(application) : EMPTY_INPUT);

  return (
    <form action={action} className="space-y-4">
      {/* Анкета уходит на модерацию только целиком заполненной: недостающее оператор всё равно
          спрашивал бы перепиской. Необязательное помечено прямо в подписи поля. */}
      <p className="text-xs text-ink-subtle">
        Заполните все поля — с пропусками анкета не уйдёт на модерацию.
      </p>

      <Field label="Ник в лиге" hint="Под ним вас увидят в таблицах и на витрине.">
        <Input name="nickname" defaultValue={v.nickname} required autoFocus placeholder="Например, Miracle-" />
      </Field>

      <Field label="Имя">
        <Input name="realName" defaultValue={v.realName} required placeholder="Как вас зовут" />
      </Field>

      <Field label="Дата рождения">
        <Input name="birthday" type="date" defaultValue={v.birthday} required />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Город">
          <Input name="city" defaultValue={v.city} required />
        </Field>
        <Field label="Страна">
          <Input name="country" defaultValue={v.country} required />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Позиция">
          <select
            name="position"
            defaultValue={v.position}
            required
            className="flex h-9 w-full rounded-md border border-hairline bg-surface-1 px-3 py-1 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="">не выбрана</option>
            {ROLES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.position ? `${r.position} — ${r.short}` : r.short}
              </option>
            ))}
          </select>
        </Field>
        <Field label="MMR" hint="Со слов игрока — проверит организатор.">
          <Input name="mmr" inputMode="numeric" defaultValue={v.mmr} required placeholder="Например, 4200" />
        </Field>
      </div>

      {/* Ссылки — единственное место, где «обязательно» не про каждое поле: у части игроков есть
          не любой из трёх профилей, поэтому требуем хотя бы один (проверяет сервер). */}
      <div className="space-y-3 rounded-md border border-hairline bg-surface-2/30 px-3 py-3">
        <p className="text-xs text-ink-muted">
          Ссылки на профиль — заполните <span className="text-ink">хотя бы одну</span>: по ней вас находят в матчах.
        </p>

        <Field label="Dotabuff">
          <Input name="dotabuff" defaultValue={v.dotabuff} placeholder="https://www.dotabuff.com/players/…" />
        </Field>

        <Field label="Stratz">
          <Input name="stratz" defaultValue={v.stratz} placeholder="https://stratz.com/players/…" />
        </Field>

        <Field label="Steam">
          <Input name="steam" defaultValue={v.steam} placeholder="https://steamcommunity.com/profiles/…" />
        </Field>
      </div>

      <Field label="Telegram" hint="Можно с @ или ссылкой — приведём к хендлу.">
        <Input name="telegram" defaultValue={v.telegram} required placeholder="@nickname" />
      </Field>

      <Field label="Достижения" optional hint="Свободный список — одна строка на достижение.">
        <textarea
          name="achievements"
          defaultValue={v.achievements}
          rows={3}
          className="flex w-full rounded-md border border-hairline bg-surface-1 px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </Field>

      <PolicyCheck />

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Отправляю…" : "Отправить заявку"}
      </Button>

      {state?.error && <p className={errorBox}>{state.error}</p>}
    </form>
  );
}

/** Ветка «я уже в ростере»: анкета не нужна — все данные уже в профиле, нужен лишь его выбор. */
function ClaimApplicationForm({ players }: { players: LinkablePlayer[] }) {
  const [state, action, pending] = useActionState<ApplyState, FormData>(sendClaim, null);
  const [picked, setPicked] = useState<LinkablePlayer | null>(null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="playerId" value={picked?.id ?? ""} />
      <PlayerPicker players={players} picked={picked} onPick={setPicked} />
      <PolicyCheck />
      <Button type="submit" disabled={pending || !picked} className="w-full">
        {pending ? "Отправляю…" : "Подать заявку на привязку"}
      </Button>
      {state?.error && <p className={errorBox}>{state.error}</p>}
    </form>
  );
}
