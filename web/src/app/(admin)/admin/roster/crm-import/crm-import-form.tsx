"use client";

import { useActionState, useMemo, useState, type ReactNode } from "react";
import { parseCrmUpload, saveCrmMatches, type ParseState, type SaveState } from "./actions";
import { Button } from "@/components/pouf/Button";
import { Checkbox } from "@/components/pouf/checkbox";
import { FormInput, FormTextarea, Label } from "@/components/pouf/Input";
import { Alert } from "@/components/pouf/feedback";
import { DropZone } from "@/components/pouf/dropzone";
import { Stepper } from "@/components/pouf/stepper";
import { Panel } from "@/app/(admin)/_components/panel";

// Мастер в два шага (короче составов — тут нет сетевого «подтянуть данные»): Источник → Разбор
// (уже сведённый с базой — какие поля какому игроку допишутся) → выбор строк → Запись.

const STEPS = ["Источник", "Разбор", "Запись"] as const;

/** ISO-дата → «12 марта 2004», для читаемости диффа. Не ISO — возвращает как есть (текст поля). */
function fmt(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime()) || !/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  return new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

function WarnDetails({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  return (
    <details
      className="rounded-chip px-(--s4) pb-[calc(var(--s3)+var(--lip)/2)] pt-[calc(var(--s3)-var(--lip)/2)] font-pouf cushion-alert"
      style={{ backgroundImage: "var(--grad-warn)" }}
    >
      <summary className="cursor-pointer text-[13px] font-extrabold text-[var(--color-warn-ink)]">{summary}</summary>
      <div className="mt-2 max-h-52 overflow-y-auto">{children}</div>
    </details>
  );
}

export function CrmImportForm() {
  const [step, setStep] = useState(0);
  const [parsed, parseAction, parsing] = useActionState<ParseState, FormData>(parseCrmUpload, null);
  const [saved, saveAction, saving] = useActionState<SaveState, FormData>(saveCrmMatches, null);
  const [skip, setSkip] = useState<Record<number, boolean>>({});

  const matches = useMemo(() => parsed?.matches ?? [], [parsed]);
  const picked = matches.filter((m) => !skip[m.playerId]);
  const totalFields = picked.reduce((n, m) => n + m.changes.length, 0);

  return (
    <div className="space-y-4">
      <Stepper steps={STEPS.map((label, i) => ({ label, onClick: () => setStep(i) }))} current={step} />

      {/* ── Шаг 1: откуда берём выгрузку ─────────────────────────────────── */}
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
              accept=".xlsx,.csv,.tsv,.json,text/csv"
              label="Перетащите выгрузку сюда"
              hint="или нажмите, чтобы выбрать: .xlsx, .csv, .tsv, .json"
            />
            <div>
              <Label htmlFor="link">…или ссылка на гугл-таблицу</Label>
              <FormInput id="link" name="link" size="sm" placeholder="https://docs.google.com/spreadsheets/d/…" className="mt-1.5" />
              <span className="mt-1.5 block font-pouf text-[11px] font-bold text-muted">
                Доступ к таблице должен быть открыт по ссылке — скачиваем её экспортом в xlsx.
              </span>
            </div>
            <div>
              <Label htmlFor="pasted">…или вставьте таблицу текстом</Label>
              <FormTextarea id="pasted" name="pasted" rows={4} className="mt-1.5" placeholder="Ник;Телеграм;Дата рождения;Город" />
            </div>
            <div>
              <Label htmlFor="tab">Только вкладка с названием, содержащим</Label>
              <FormInput id="tab" name="tab" size="sm" placeholder="игроки" className="mt-1.5" />
              <span className="mt-1.5 block font-pouf text-[11px] font-bold text-muted">
                Пусто — пробуем каждый лист книги, берём первый, где нашлась шапка с ником.
              </span>
            </div>
            <label className="flex items-center gap-2.5">
              <Checkbox name="force" />
              <span className="font-pouf text-[13px] font-bold text-ink">
                Перезаписывать уже заполненные поля
              </span>
            </label>
            <span className="block font-pouf text-[11px] font-bold text-muted">
              По умолчанию трогаем только пустые поля — то, что уже стоит в профиле, CRM не перебивает.
            </span>
            <Button type="submit" size="sm" disabled={parsing}>
              {parsing ? "Разбираю…" : "Разобрать"}
            </Button>
          </form>
        </Panel>
      )}

      {/* ── Шаг 2: что разобралось и с чем свелось ──────────────────────── */}
      {step === 1 && (
        <Panel
          title={matches.length > 0 ? `К записи готовы: ${matches.length} игрок(ов)` : "Разбор"}
          hint={parsed?.note ?? undefined}
        >
          <div className="space-y-4">
            {parsing && <p className="font-pouf text-sm font-bold text-muted">Разбираю…</p>}
            {parsed?.error && <Alert tone="err" block>{parsed.error}</Alert>}

            {parsed && !parsed.error && (
              <>
                <p className="font-pouf text-xs font-bold text-muted">
                  Без изменений: {parsed.unchanged ?? 0} · нет в базе: {parsed.unmatched?.length ?? 0}
                </p>

                {matches.length === 0 ? (
                  <Alert tone="warn" block>Нечего записывать — либо всё уже стоит в базе, либо никто не опознан.</Alert>
                ) : (
                  <ul className="space-y-2">
                    {matches.map((m) => (
                      <li key={m.playerId} className="rounded-blob bg-surface-2 p-3 font-pouf cushion-field">
                        <div className="flex flex-wrap items-center gap-2">
                          <Checkbox
                            id={`pick-${m.playerId}`}
                            checked={!skip[m.playerId]}
                            onCheckedChange={(v) => setSkip((s) => ({ ...s, [m.playerId]: v !== true }))}
                          />
                          <label
                            htmlFor={`pick-${m.playerId}`}
                            className={`cursor-pointer text-sm font-black ${skip[m.playerId] ? "text-muted line-through" : "text-ink"}`}
                          >
                            {m.playerNickname}
                          </label>
                          {m.nickname.toLowerCase() !== m.playerNickname.toLowerCase() && (
                            <span className="text-xs font-bold text-muted">в CRM «{m.nickname}»</span>
                          )}
                        </div>
                        <ul className="mt-2 space-y-0.5 pl-7">
                          {m.changes.map((c, i) => (
                            <li key={i} className="text-xs font-bold text-muted">
                              <span className="text-ink">{c.label}</span>:{" "}
                              {c.from ? <span className="line-through">{fmt(c.from)}</span> : <span className="italic">пусто</span>}
                              {" → "}
                              <span className="text-[var(--color-ok-ink)]">{fmt(c.to)}</span>
                            </li>
                          ))}
                        </ul>
                        {m.problems.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5 pl-7">
                            {m.problems.map((p, i) => (
                              <li key={i} className="text-[11px] font-bold text-[var(--color-warn-ink)]">⚠ {p}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {parsed.unmatched && parsed.unmatched.length > 0 && (
                  <WarnDetails summary={`Нет в базе: ${parsed.unmatched.length} — другой дивизион или прошлый сезон`}>
                    <p className="text-[11px] font-bold text-muted">{parsed.unmatched.join(", ")}</p>
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

      {/* ── Шаг 3: запись ────────────────────────────────────────────────── */}
      {step === 2 && (
        <Panel
          title={`К записи: ${picked.length} игрок(ов), ${totalFields} пол(ей)`}
          hint="Профили обновятся сразу. Строки, снятые флажком на прошлом шаге, не тронем."
        >
          <form action={saveAction} className="space-y-4">
            <input type="hidden" name="matches" value={JSON.stringify(matches)} />
            {picked.map((m) => (
              <input key={m.playerId} type="hidden" name="pick" value={m.playerId} />
            ))}

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="quiet" onClick={() => setStep(1)}>
                Назад
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Записываю…" : "Записать в профили"}
              </Button>
            </div>

            {saved?.error && <Alert tone="err" block>{saved.error}</Alert>}
            {saved?.updated !== undefined && (
              <Alert tone="ok" block>
                Обновлено игроков: {saved.updated}, полей: {saved.fields}.
              </Alert>
            )}
          </form>
        </Panel>
      )}
    </div>
  );
}
