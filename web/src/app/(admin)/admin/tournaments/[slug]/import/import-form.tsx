"use client";

import { useActionState, useState } from "react";
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
import { FormInput, FormTextarea } from "@/components/pouf/Input";

// Мастер импорта: три пронумерованных шага, назад можно на любой. Раньше все три жили на одном
// экране простынёй, и было непонятно, что уже сделано, а что ещё нет.
//
// Состояние между шагами не храним ни в базе, ни в сессии — разобранный черновик едет обратно тем
// же JSON, который оператор видел в превью. Что показали, то и запишется.

const box = "rounded-lg border border-hairline bg-surface-1 p-4";
const errorBox = "rounded-md border border-rose-200 bg-rose-100 px-3 py-2 text-sm text-rose-700";

const STEPS = ["Источник", "Разбор", "Запись"] as const;

function Steps({ step, onGo }: { step: number; onGo: (n: number) => void }) {
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {STEPS.map((label, i) => {
        const done = i < step;
        return (
          <li key={label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => done && onGo(i)}
              disabled={!done}
              className={`flex items-center gap-2 rounded-[12px] px-3 py-1.5 text-xs font-black ${
                i === step
                  ? "bg-accent-fill text-[var(--on-accent)]"
                  : done
                    ? "bg-surface-2 text-ink hover:text-accent-bright"
                    : "bg-surface-2 text-ink-subtle"
              }`}
            >
              <span className="tabular-nums">{i + 1}</span>
              {label}
            </button>
            {i < STEPS.length - 1 && <span className="text-ink-subtle">→</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function ImportForm({
  tournamentSlug,
  divisions,
}: {
  tournamentSlug: string;
  divisions: { id: number; name: string; short: string }[];
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
      <Steps step={step} onGo={setStep} />

      {/* ── Шаг 1: откуда берём составы ─────────────────────────────────── */}
      {step === 0 && (
        <form
          action={(data) => {
            parseAction(data);
            setStep(1);
          }}
          className={`${box} space-y-3`}
        >
          <div>
            <label htmlFor="file" className="text-xs text-ink-muted">Файл (.xlsx, .csv, .tsv)</label>
            <FormInput id="file" name="file" type="file" accept=".xlsx,.csv,.tsv,text/csv" className="mt-1" />
          </div>
          <div>
            <label htmlFor="link" className="text-xs text-ink-muted">…или ссылка на гугл-таблицу</label>
            <FormInput id="link" name="link" placeholder="https://docs.google.com/spreadsheets/d/…" className="mt-1" />
            <span className="mt-1 block text-[11px] text-ink-subtle">
              Доступ к таблице должен быть открыт по ссылке — скачиваем её экспортом в xlsx.
            </span>
          </div>
          <div>
            <label htmlFor="pasted" className="text-xs text-ink-muted">…или вставьте таблицу текстом</label>
            <FormTextarea id="pasted" name="pasted" rows={4} className="mt-1" placeholder="Команда;Ник;Роль;MMR;Ссылка" />
          </div>
          <div>
            <label htmlFor="sheet" className="text-xs text-ink-muted">Только листы с названием, содержащим</label>
            <FormInput id="sheet" name="sheet" placeholder="команды" className="mt-1" />
            <span className="mt-1 block text-[11px] text-ink-subtle">
              Пусто — берём все листы книги. Пригодится, когда в таблице есть и составы, и расписание.
            </span>
          </div>
          <Button type="submit" size="sm" disabled={parsing}>
            {parsing ? "Разбираю…" : "Разобрать →"}
          </Button>
        </form>
      )}

      {/* ── Шаг 2: что разобралось ──────────────────────────────────────── */}
      {step === 1 && (
        <div className={`${box} space-y-3`}>
          {parsing && <p className="text-sm text-ink-muted">Разбираю таблицу…</p>}
          {parsed?.error && <p className={errorBox}>{parsed.error}</p>}

          {teams.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">
                  Разобрано команд: {teams.length} · игроков: {teams.reduce((n, t) => n + t.players.length, 0)}
                </h2>
                {parsed?.note && <span className="text-xs text-ink-subtle">{parsed.note}</span>}
              </div>

              {parsed?.sheets && parsed.sheets.length > 0 && (
                <div className="overflow-x-auto rounded-md border border-hairline bg-surface-2">
                  <table className="w-full text-xs">
                    <thead className="text-ink-subtle">
                      <tr>
                        <th className="px-2 py-1 text-left font-semibold">Лист</th>
                        <th className="px-2 py-1 text-left font-semibold">Раскладка</th>
                        <th className="px-2 py-1 text-right font-semibold">Команд</th>
                        <th className="px-2 py-1 text-right font-semibold">Игроков</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.sheets.map((sh) => (
                        <tr key={sh.name} className={sh.players === 0 ? "text-ink-subtle" : ""}>
                          <td className="px-2 py-1">{sh.name}</td>
                          <td className="px-2 py-1">{sh.layout}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{sh.teams}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{sh.players}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <form action={enrichAction} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="teams" value={JSON.stringify(teams)} />
                <Button type="submit" size="sm" variant="quiet" disabled={enriching}>
                  {enriching ? "Тяну из Steam и OpenDota…" : "Подтянуть данные"}
                </Button>
                <span className="text-[11px] text-ink-subtle">
                  Именные ссылки Steam → account_id, ранг и ник из OpenDota. Ходит в сеть — на большом
                  файле это минута.
                </span>
              </form>
              {enriched?.error && <p className={errorBox}>{enriched.error}</p>}
              {enriched?.notes && enriched.notes.length > 0 && (
                <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-hairline bg-surface-2 p-2">
                  {enriched.notes.map((n, i) => (
                    <li key={i} className={`text-[11px] ${n.level === "warn" ? "text-amber-700" : "text-ink-subtle"}`}>
                      {n.nickname}: {n.text}
                    </li>
                  ))}
                </ul>
              )}

              {unresolved.length > 0 && (
                <details className="rounded-md border border-amber-200 bg-amber-100 p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-amber-700">
                    Без account_id: {unresolved.length} — этих игроков не найдёт ни один матч
                  </summary>
                  <ul className="mt-2 space-y-0.5">
                    {unresolved.map((u, i) => (
                      <li key={i} className="truncate text-[11px] text-ink-subtle">
                        <span className="text-ink">{u.nickname}</span> · {u.team} ·{" "}
                        {u.link ? `ссылка не распознана: ${u.link}` : "ссылки нет"}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <ul className="space-y-2">
                {teams.map((t) => (
                  <li key={t.slug} className="rounded-md border border-hairline bg-surface-2 p-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!skip[t.slug]}
                        onChange={(e) => setSkip((s) => ({ ...s, [t.slug]: !e.target.checked }))}
                      />
                      <span className={`text-sm font-semibold ${skip[t.slug] ? "text-ink-subtle line-through" : ""}`}>
                        {t.name}
                      </span>
                      <span className="text-xs text-ink-subtle">
                        {t.tag ?? "без тега"} · /{t.slug} · {t.players.length} игрок(ов)
                      </span>
                    </label>
                    <ul className="mt-2 space-y-0.5 pl-6">
                      {t.players.map((p, i) => (
                        <li key={`${t.slug}-${i}`} className="text-xs text-ink-muted">
                          <span className="text-ink">{p.nickname}</span>
                          {p.realName && <span className="text-ink-subtle"> · {p.realName}</span>}
                          <span className="text-ink-subtle"> · {roleLabel(p.role) ?? "роль не разобрана"}</span>
                          {p.mmr && <span className="text-ink-subtle"> · {p.mmr} MMR</span>}
                          <span className={p.accountId ? "text-emerald-700" : "text-amber-700"}>
                            {p.accountId ? ` · id ${p.accountId}` : " · без account_id"}
                          </span>
                          {rankLabel(p.rank) && <span className="text-ink-subtle"> · {rankLabel(p.rank)}</span>}
                          {p.dotaName && p.dotaName.toLowerCase() !== p.nickname.toLowerCase() && (
                            <span className="text-ink-subtle"> · в доте «{p.dotaName}»</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>

              {parsed?.skipped && parsed.skipped.length > 0 && (
                <details className="rounded-md border border-amber-200 bg-amber-100 p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-amber-700">
                    Не разобрано строк: {parsed.skipped.length} — проверьте, не потерялись ли игроки
                  </summary>
                  <ul className="mt-2 space-y-0.5">
                    {parsed.skipped.map((row, i) => (
                      <li key={i} className="truncate text-[11px] text-ink-subtle">{row}</li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="quiet" onClick={() => setStep(0)}>
              ← Назад
            </Button>
            <Button type="button" size="sm" onClick={() => setStep(2)} disabled={picked.length === 0}>
              Дальше: запись →
            </Button>
          </div>
        </div>
      )}

      {/* ── Шаг 3: куда записываем ──────────────────────────────────────── */}
      {step === 2 && (
        <form action={saveAction} className={`${box} space-y-3`}>
          <input type="hidden" name="tournamentSlug" value={tournamentSlug} />
          <input type="hidden" name="teams" value={JSON.stringify(teams)} />
          {picked.map((t) => (
            <input key={t.slug} type="hidden" name="pick" value={t.slug} />
          ))}

          <h2 className="text-sm font-semibold">
            К записи: {picked.length} команд(ы), {picked.reduce((n, t) => n + t.players.length, 0)} игрок(ов)
          </h2>

          <label className="block max-w-xs">
            <span className="text-xs text-ink-muted">Дивизион</span>
            <select
              name="divisionId"
              defaultValue={divisions[0]?.id ?? ""}
              className="mt-1 h-9 w-full rounded-md border border-hairline bg-surface-2 px-2 text-sm"
            >
              {divisions.length === 0 && <option value="">в турнире нет дивизионов</option>}
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>

          <p className="text-[11px] text-ink-subtle">
            Команды, игроки и составы появятся в ростере сразу. Игроки, которые уже есть, привяжутся
            к своим профилям. Команду с непроходимым замечанием пропустим — её видно в отчёте.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="quiet" onClick={() => setStep(1)}>
              ← Назад
            </Button>
            <Button type="submit" size="sm" disabled={saving || divisions.length === 0}>
              {saving ? "Записываю…" : "Записать в ростер"}
            </Button>
          </div>

          {saved?.error && <p className={errorBox}>{saved.error}</p>}
          {saved?.results && (
            <div className="space-y-2">
              <p className="text-sm text-emerald-700">
                Записано команд: {saved.results.filter((r) => r.ok).length} из {saved.results.length}.{" "}
                <Link href={`/admin/tournaments/${tournamentSlug}`} className="underline">
                  Открыть турнир
                </Link>
              </p>
              <ul className="space-y-1">
                {saved.results.map((r) => (
                  <li
                    key={r.team}
                    className={`rounded-md border px-2 py-1 text-xs ${
                      r.ok ? "border-hairline bg-surface-2 text-ink-subtle" : "border-rose-200 bg-rose-100 text-rose-700"
                    }`}
                  >
                    <span className="font-semibold">{r.team}</span>
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
      )}
    </div>
  );
}
