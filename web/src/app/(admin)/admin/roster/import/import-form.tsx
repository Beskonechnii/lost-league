"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import {
  enrichDrafts,
  parseUpload,
  saveDrafts,
  type EnrichState,
  type ParseState,
  type SaveState,
} from "./actions";
import { rankLabel } from "@/lib/dota-rank";
import { roleLabel } from "@/lib/roles";
import { Button } from "@/components/pouf/Button";
import { Checkbox } from "@/components/pouf/checkbox";
import { Field, FormInput, FormSelect, FormTextarea, Label } from "@/components/pouf/Input";
import { Alert, EmptyState } from "@/components/pouf/feedback";
import { SkeletonList } from "@/components/pouf/skeleton";
import { DropZone } from "@/components/pouf/dropzone";
import { Stepper } from "@/components/pouf/stepper";
import { DataCell, DataRow, DataTable } from "@/components/pouf/data-table";
import { Panel } from "@/app/(admin)/_components/panel";
import { WarnDetails } from "./warn-details";

// Мастер импорта: три пронумерованных шага, назад можно на любой. Разбор не знает про турнир —
// назначение выбирается на последнем шаге, из ЛЮБОГО турнира сразу (решение 04.09.2026: раньше
// страница жила внутри карточки одного турнира и предлагала только его дивизионы).
//
// Состояние между шагами не храним ни в базе, ни в сессии — разобранный черновик едет обратно тем
// же JSON, который оператор видел в превью. Что показали, то и запишется.

const STEPS = ["Источник", "Разбор", "Запись"] as const;

export type TournamentOption = {
  slug: string;
  name: string;
  divisions: { id: number; name: string }[];
};

/** Служебное значение «Назначения»: общий ростер вне турнира. Пустая строка занята другим
 *  смыслом — «оператор ещё не выбрал», и форма на ней не отправляется (Э11). */
const NO_TOURNAMENT = "none";

export function ImportForm({
  tournaments,
  defaultDivisionId,
  from,
}: {
  tournaments: TournamentOption[];
  /** Дивизион турнира, из которого пришли, — подставляется ТОЛЬКО когда он у турнира один.
   *  При двух и более выбирает оператор: цена тихой записи в чужой дивизион несимметрична. */
  defaultDivisionId?: number | null;
  /** Турнир-контекст: его именем подписана подсказка под «Назначением». */
  from?: { slug: string; name: string } | null;
}) {
  const [step, setStep] = useState(0);
  const divisionRef = useRef<HTMLSelectElement>(null);
  const [divisionErr, setDivisionErr] = useState(false);
  const [parsed, parseAction, parsing] = useActionState<ParseState, FormData>(parseUpload, null);
  const [enriched, enrichAction, enriching] = useActionState<EnrichState, FormData>(enrichDrafts, null);
  const [saved, saveAction, saving] = useActionState<SaveState, FormData>(saveDrafts, null);
  const [skip, setSkip] = useState<Record<string, boolean>>({});

  // Обогащённый черновик главнее исходного разбора: после «подтянуть» и превью, и запись идут по нему.
  const teams = enriched?.teams ?? parsed?.teams ?? [];
  const picked = teams.filter((t) => !skip[t.slug]);

  // Игрок без account_id в архиве матчей не находится (см. §7 CLAUDE.md), поэтому такие строки
  // собираем отдельным списком: ссылка есть, но не разобрана — повод поправить её в таблице
  // или дожать «Подтянуть данные» (именной адрес Steam резолвится только сетью).
  const unresolved = picked.flatMap((t) =>
    t.players
      .filter((p) => !p.accountId)
      .map((p) => ({
        team: t.name,
        nickname: p.nickname,
        link: p.dotabuffUrl ?? p.stratzUrl ?? p.steamUrl ?? null,
      })),
  );

  // Подсказка под «Назначением» объясняет состояние поля ДО отказа: почему подставлено, почему
  // пусто и почему угадывать не будем. Турнир-контекст ищем в списке — так же и в мастере
  // создания турнира, где список состоит из него одного.
  const ctx = from ? tournaments.find((t) => t.slug === from.slug) ?? null : null;
  const divisionHint = tournaments.every((t) => t.divisions.length === 0)
    ? "Ни в одном турнире пока нет дивизионов — доступен только общий ростер."
    : ctx && ctx.divisions.length === 1
      ? `Дивизион «${ctx.divisions[0].name}» у турнира «${ctx.name}» единственный — подставлен сам`
      : ctx && ctx.divisions.length > 1
        ? `У турнира «${ctx.name}» дивизионов несколько — выберите, в какой записать: угадывать не будем`
        : "Дивизион любого турнира или общий ростер без привязки";

  return (
    <div className="space-y-4">
      <Stepper
        steps={STEPS.map((label, i) => ({ label, onClick: () => setStep(i) }))}
        current={step}
      />

      {/* ── Шаг 1: откуда берём составы ─────────────────────────────────── */}
      {step === 0 && (
        <Panel title="Источник" hint="Достаточно одного способа: файл, ссылка или текст.">
          <form
            action={(data) => {
              parseAction(data);
              setStep(1);
            }}
            className="space-y-4"
          >
            <DropZone
              name="file"
              accept=".xlsx,.csv,.tsv,text/csv"
              label="Перетащите таблицу сюда"
              hint="или нажмите, чтобы выбрать: .xlsx, .csv, .tsv"
            />
            <div>
              <Label htmlFor="link">…или ссылка на гугл-таблицу</Label>
              <FormInput
                id="link"
                name="link"
                size="sm"
                placeholder="https://docs.google.com/spreadsheets/d/…"
                className="mt-1.5"
              />
              <span className="mt-1.5 block font-pouf text-[11px] font-bold text-muted">
                Доступ к таблице должен быть открыт по ссылке — скачиваем её экспортом в xlsx.
              </span>
            </div>
            <div>
              <Label htmlFor="pasted">…или вставьте таблицу текстом</Label>
              <FormTextarea id="pasted" name="pasted" rows={4} className="mt-1.5" placeholder="Команда;Ник;Роль;MMR;Ссылка" />
            </div>
            <div>
              <Label htmlFor="sheet">Только листы с названием, содержащим</Label>
              <FormInput id="sheet" name="sheet" size="sm" placeholder="команды" className="mt-1.5" />
              <span className="mt-1.5 block font-pouf text-[11px] font-bold text-muted">
                Пусто — берём все листы книги. Пригодится, когда в таблице есть и составы, и расписание.
              </span>
            </div>
            <Button type="submit" size="sm" disabled={parsing}>
              {parsing ? "Разбираю…" : "Разобрать"}
            </Button>
          </form>
        </Panel>
      )}

      {/* ── Шаг 2: что разобралось ──────────────────────────────────────── */}
      {step === 1 && (
        <Panel
          title={
            teams.length > 0
              ? `Разобрано команд: ${teams.length} · игроков: ${teams.reduce((n, t) => n + t.players.length, 0)}`
              : "Разбор"
          }
          hint={parsed?.note ?? undefined}
        >
          <div className="space-y-4">
            {/* Скелет рисует форму будущего превью — строка «Разбираю таблицу…» её не рисовала. */}
            {parsing && <SkeletonList count={4} label="Разбираю таблицу" />}
            {parsed?.error && <Alert tone="err" block>{parsed.error}</Alert>}

            {!parsing && parsed && !parsed.error && teams.length === 0 && (
              <EmptyState icon="database" title="Ни одной команды не разобрано">
                Проверьте, тот ли лист и есть ли шапка колонок.
              </EmptyState>
            )}

            {teams.length > 0 && (
              <>
                {parsed?.sheets && parsed.sheets.length > 0 && (
                  <DataTable
                    caption="Что нашлось на листах книги"
                    columns={[
                      { label: "Лист" },
                      { label: "Раскладка" },
                      { label: "Команд", align: "right" },
                      { label: "Игроков", align: "right" },
                    ]}
                  >
                    {parsed.sheets.map((sh) => (
                      <DataRow key={sh.name}>
                        <DataCell muted={sh.players === 0}>{sh.name}</DataCell>
                        <DataCell muted>{sh.layout}</DataCell>
                        <DataCell align="right" muted={sh.players === 0}>{sh.teams}</DataCell>
                        <DataCell align="right" muted={sh.players === 0}>{sh.players}</DataCell>
                      </DataRow>
                    ))}
                  </DataTable>
                )}

                <form action={enrichAction} className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="teams" value={JSON.stringify(teams)} />
                  <Button type="submit" size="sm" variant="quiet" disabled={enriching}>
                    {enriching ? "Тяну из Steam и OpenDota…" : "Подтянуть данные"}
                  </Button>
                  <span className="font-pouf text-[11px] font-bold text-muted">
                    Именные ссылки Steam → account_id, ранг и ник из OpenDota. Ходит в сеть — на большом
                    файле это минута.
                  </span>
                </form>
                {enriched?.error && <Alert tone="err" block>{enriched.error}</Alert>}
                {enriched?.notes && enriched.notes.length > 0 && (
                  <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-blob bg-surface-2 p-3 font-pouf cushion-field">
                    {enriched.notes.map((n, i) => (
                      <li
                        key={i}
                        className={`text-[11px] font-bold ${n.level === "warn" ? "text-[var(--color-warn-ink)]" : "text-muted"}`}
                      >
                        {n.nickname}: {n.text}
                      </li>
                    ))}
                  </ul>
                )}

                {unresolved.length > 0 && (
                  <WarnDetails summary={`Без account_id: ${unresolved.length} — этих игроков не найдёт ни один матч`}>
                    <ul className="space-y-0.5">
                      {unresolved.map((u, i) => (
                        <li key={i} className="truncate text-[11px] font-bold text-[var(--color-warn-ink)]">
                          <span className="font-black">{u.nickname}</span> · {u.team} ·{" "}
                          {u.link ? `ссылка не распознана: ${u.link}` : "ссылки нет"}
                        </li>
                      ))}
                    </ul>
                  </WarnDetails>
                )}

                <ul className="space-y-2">
                  {teams.map((t) => (
                    <li key={t.slug} className="rounded-blob bg-surface-2 p-3 font-pouf cushion-field">
                      {/* Подпись отдельным <label for>, а не обёрткой: китовый флажок это
                          <button> radix, и клик по тексту внутри обёртки уходил бы в его
                          скрытый input, а не во флажок. */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Checkbox
                          id={`pick-${t.slug}`}
                          checked={!skip[t.slug]}
                          onCheckedChange={(v) => setSkip((s) => ({ ...s, [t.slug]: v !== true }))}
                        />
                        <label
                          htmlFor={`pick-${t.slug}`}
                          className={`cursor-pointer text-sm font-black ${
                            skip[t.slug] ? "text-muted line-through" : "text-ink"
                          }`}
                        >
                          {t.name}
                        </label>
                        <span className="text-xs font-bold text-muted">
                          {t.tag ?? "без тега"} · /{t.slug} · {t.players.length} игрок(ов)
                        </span>
                      </div>
                      <ul className="mt-2 space-y-0.5 pl-7">
                        {t.players.map((p, i) => (
                          <li key={`${t.slug}-${i}`} className="text-xs font-bold text-muted">
                            <span className="text-ink">{p.nickname}</span>
                            {p.realName && <span> · {[p.realName, p.realSurname].filter(Boolean).join(" ")}</span>}
                            <span> · {roleLabel(p.role) ?? "роль не разобрана"}</span>
                            {p.mmr && <span> · {p.mmr} MMR</span>}
                            <span className={p.accountId ? "text-[var(--color-ok-ink)]" : "text-[var(--color-warn-ink)]"}>
                              {p.accountId ? ` · id ${p.accountId}` : " · без account_id"}
                            </span>
                            {rankLabel(p.rank) && <span> · {rankLabel(p.rank)}</span>}
                            {p.dotaName && p.dotaName.toLowerCase() !== p.nickname.toLowerCase() && (
                              <span> · в доте «{p.dotaName}»</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>

                {parsed?.skipped && parsed.skipped.length > 0 && (
                  <WarnDetails summary={`Не разобрано строк: ${parsed.skipped.length} — проверьте, не потерялись ли игроки`}>
                    <ul className="space-y-0.5">
                      {parsed.skipped.map((row, i) => (
                        <li key={i} className="truncate text-[11px] font-bold text-[var(--color-warn-ink)]">{row}</li>
                      ))}
                    </ul>
                  </WarnDetails>
                )}
              </>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="quiet" onClick={() => setStep(0)}>
                Назад
              </Button>
              <Button type="button" size="sm" onClick={() => setStep(2)} disabled={picked.length === 0}>
                Дальше: запись
              </Button>
            </div>
          </div>
        </Panel>
      )}

      {/* ── Шаг 3: куда записываем ──────────────────────────────────────── */}
      {step === 2 && (
        <Panel
          title={`К записи: ${picked.length} команд(ы), ${picked.reduce((n, t) => n + t.players.length, 0)} игрок(ов)`}
          hint="Команды, игроки и составы появятся в ростере сразу. Игроки, которые уже есть, привяжутся к своим профилям. Команду с непроходимым замечанием пропустим — её видно в отчёте."
        >
          <form action={saveAction} className="space-y-4">
            <input type="hidden" name="teams" value={JSON.stringify(teams)} />
            {picked.map((t) => (
              <input key={t.slug} type="hidden" name="pick" value={t.slug} />
            ))}

            <div className="max-w-xs">
              <Field
                label="Назначение"
                hint={divisionHint}
                error={
                  divisionErr
                    ? "Выберите назначение: дивизион турнира или общий ростер без привязки"
                    : undefined
                }
              >
                {(id, describedBy) => (
                  <FormSelect
                    ref={divisionRef}
                    id={id}
                    name="divisionId"
                    size="sm"
                    required
                    invalid={divisionErr}
                    aria-describedby={describedBy}
                    defaultValue={defaultDivisionId ?? ""}
                    onChange={() => setDivisionErr(false)}
                    // `required` держит барьер и без JS. Но нативный пузырь мимо Light Clay и мимо
                    // нашей формулировки — гасим его и показываем китовую пару invalid + error.
                    onInvalid={(e) => {
                      e.preventDefault();
                      setDivisionErr(true);
                      divisionRef.current?.scrollIntoView({ block: "center" });
                      divisionRef.current?.focus();
                    }}
                  >
                    {/* Три значения, а не два: «не выбрал» и «общий ростер» больше не одно и то же
                        пусто — второе выбирают, а не получают молчанием. */}
                    <option value="" disabled>
                      — Выберите назначение —
                    </option>
                    <option value={NO_TOURNAMENT}>Общий ростер — без турнира</option>
                    {tournaments.map((t) =>
                      t.divisions.length > 0 ? (
                        <optgroup key={t.slug} label={t.name}>
                          {t.divisions.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </optgroup>
                      ) : null,
                    )}
                  </FormSelect>
                )}
              </Field>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="quiet" onClick={() => setStep(1)}>
                Назад
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Записываю…" : "Записать в ростер"}
              </Button>
            </div>

            {saved?.error && <Alert tone="err" block>{saved.error}</Alert>}
            {saved?.results && (
              <div className="space-y-2">
                <Alert tone="ok" block>
                  Записано команд: {saved.results.filter((r) => r.ok).length} из {saved.results.length}.{" "}
                  {/* Возврата к турниру здесь больше нет — он в шапке экрана и виден до записи. */}
                  <Link href="/roster" className="underline">
                    Открыть ростер
                  </Link>
                </Alert>
                <ul className="space-y-1">
                  {saved.results.map((r) => (
                    <li
                      key={r.team}
                      className={`rounded-blob px-3 py-2 font-pouf text-xs font-bold ${
                        r.ok ? "bg-surface-2 text-muted cushion-field" : "cushion-alert"
                      }`}
                      style={
                        r.ok
                          ? undefined
                          : { backgroundImage: "var(--grad-err)", color: "var(--color-err-ink)" }
                      }
                    >
                      <span className="font-black">{r.team}</span>
                      {r.ok ? " — записана" : " — пропущена"}
                      {r.problems.length > 0 && (
                        <ul className="mt-1 space-y-0.5 pl-3">
                          {r.problems.map((p, i) => (
                            <li key={i}>{p.text}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </form>
        </Panel>
      )}
    </div>
  );
}
