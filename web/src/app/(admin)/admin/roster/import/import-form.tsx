"use client";

import { useActionState, useState, type ReactNode } from "react";
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
import { FormInput, FormSelect, FormTextarea, Label } from "@/components/pouf/Input";
import { Alert } from "@/components/pouf/feedback";
import { DropZone } from "@/components/pouf/dropzone";
import { Stepper } from "@/components/pouf/stepper";
import { DataCell, DataRow, DataTable } from "@/components/pouf/data-table";
import { Panel } from "@/app/(admin)/_components/panel";

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

/**
 * Свёрнутый список замечаний на предупреждающей коже. Не `Alert`: у алерта нет
 * содержимого, которое раскрывают, а тут под заголовком лежит список из
 * полусотни строк — развёрнутым он топит собой весь экран.
 */
function WarnDetails({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  return (
    <details
      className="rounded-chip px-(--s4) pb-[calc(var(--s3)+var(--lip)/2)] pt-[calc(var(--s3)-var(--lip)/2)] font-pouf cushion-alert"
      style={{ backgroundImage: "var(--grad-warn)" }}
    >
      <summary className="cursor-pointer text-[13px] font-extrabold text-[var(--color-warn-ink)]">
        {summary}
      </summary>
      <div className="mt-2 max-h-52 overflow-y-auto">{children}</div>
    </details>
  );
}

export function ImportForm({
  tournaments,
  defaultDivisionId,
}: {
  tournaments: TournamentOption[];
  /** Если пришли со страницы конкретного турнира — предвыбрать его первый дивизион, а не общий пул. */
  defaultDivisionId?: number | null;
}) {
  const [step, setStep] = useState(0);
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
            {parsing && <p className="font-pouf text-sm font-bold text-muted">Разбираю таблицу…</p>}
            {parsed?.error && <Alert tone="err" block>{parsed.error}</Alert>}

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
                            {p.realName && <span> · {p.realName}</span>}
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
              <Label htmlFor="divisionId">Назначение</Label>
              <FormSelect
                id="divisionId"
                name="divisionId"
                size="sm"
                defaultValue={defaultDivisionId ?? ""}
                className="mt-1.5"
              >
                {/* Пусто = общий пул, вне турнира — не «дивизион не выбран», а осознанное третье
                    значение (writeTeamToRoster(divisionId=null) его и ждёт). */}
                <option value="">Общий ростер — без турнира</option>
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
              {tournaments.every((t) => t.divisions.length === 0) && (
                <span className="mt-1.5 block font-pouf text-[11px] font-bold text-muted">
                  Ни в одном турнире пока нет дивизионов — доступен только общий ростер.
                </span>
              )}
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
