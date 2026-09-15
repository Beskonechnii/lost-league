"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button as PoufButton } from "@/components/pouf/Button";
import { Input as PoufInput } from "@/components/pouf/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/pouf/select";
import { Card } from "@/components/pouf/surface";
import { Text } from "@/components/pouf/text";
import { awardTeamTpAction, revertTeamTpAction } from "./actions";

// Вкладка «Команды» зачёта TP. В отличие от панели игроков здесь вводится СУММА НАЧИСЛЕНИЯ, а не
// итог: команде начисляют разово — за место, за заслуги, — и итог это сумма строк; ввод итогом стёр
// бы «за что». По той же причине ошибочная строка не правится и не удаляется, а гасится обратной:
// реестр отвечает на вопрос «за что и когда» (ТЗ 13).

export type TeamRow = { id: number; name: string; score: number | null; place: number | null };
export type LedgerRow = {
  id: number;
  teamId: number;
  teamName: string;
  amount: number;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
};

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleString("ru", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Форма начисления: команда, сколько, за что. Турнир — текущий, задним числом экран не пишет. */
function AwardForm({ teams, onDone }: { teams: TeamRow[]; onDone: () => void }) {
  const [teamId, setTeamId] = useState("");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = value.trim() === "" || value.trim() === "-" ? 0 : Number(value);
  const picked = teams.find((t) => String(t.id) === teamId) ?? null;
  const valid = picked !== null && Number.isInteger(amount) && amount !== 0;

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    const res = await awardTeamTpAction(picked.id, amount, note);
    setBusy(false);
    if ("error" in res) return setError(res.error);
    setValue("");
    setNote("");
    onDone();
  };

  return (
    <Card>
      <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="min-w-0 flex-1">
          <Text size="sm" muted>
            Команда
          </Text>
          <div className="mt-1">
            {/* Пустая строка, а не undefined: у radix «не выбрано» — это и `""` тоже
                (`shouldShowPlaceholder`), зато поле управляемое с первой отрисовки и React не ругается
                на переход uncontrolled → controlled. */}
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger size="sm" aria-label="Команда">
                <SelectValue placeholder="Выберите команду" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}
                    {t.score !== null ? ` · ${t.score} TP` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="w-full md:w-32">
          <PoufInput
            value={value}
            onChange={setValue}
            onKeyDown={(e) => e.key === "Enter" && save()}
            inputMode="numeric"
            label="Начислить"
            placeholder="+ очки"
          />
        </div>

        <div className="min-w-0 flex-1">
          <PoufInput
            value={note}
            onChange={setNote}
            onKeyDown={(e) => e.key === "Enter" && save()}
            label="За что"
            placeholder="например: 1 место D1"
          />
        </div>

        <PoufButton onClick={save} disabled={!valid} loading={busy}>
          {valid ? `Начислить ${amount > 0 ? "+" : ""}${amount}` : "Начислить"}
        </PoufButton>
      </div>
      {picked && (
        <Text size="sm" muted>
          Сейчас у «{picked.name}» {picked.score ?? 0} TP{valid ? ` → станет ${(picked.score ?? 0) + amount}` : ""}
        </Text>
      )}
      {error && <span className="text-[13px] font-bold text-[var(--down)]">{error}</span>}
      </div>
    </Card>
  );
}

/** Строка журнала с отменой. Отмена пишет обратное начисление — сама строка остаётся на месте. */
function LedgerLine({ row, onDone }: { row: LedgerRow; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revert = async () => {
    setBusy(true);
    setError(null);
    const res = await revertTeamTpAction(row.id);
    setBusy(false);
    if ("error" in res) return setError(res.error);
    onDone();
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
      <span className="w-32 shrink-0 text-[13px] font-bold tabular-nums text-muted">{dateLabel(row.createdAt)}</span>
      <Link href={`/roster/teams/${row.teamId}`} target="_blank" className="min-w-0 flex-1 truncate font-bold hover:underline">
        {row.teamName}
      </Link>
      <span
        className={`w-16 shrink-0 text-right font-black tabular-nums ${
          row.amount < 0 ? "text-[var(--down)]" : "text-[var(--accent-ink)]"
        }`}
      >
        {row.amount > 0 ? "+" : ""}
        {row.amount}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-muted">{row.note ?? "—"}</span>
      <span className="w-32 shrink-0 truncate text-[13px] font-bold text-muted">{row.createdBy ?? "—"}</span>
      <PoufButton variant="quiet" size="sm" onClick={revert} loading={busy}>
        Отменить
      </PoufButton>
      {error && <span className="text-[13px] font-bold text-[var(--down)]">{error}</span>}
    </div>
  );
}

export function TeamTpAdmin({ teams, ledger }: { teams: TeamRow[]; ledger: LedgerRow[] }) {
  const router = useRouter();
  const refresh = () => router.refresh();

  // Список «кому начислено» — в порядке зачёта; сам список команд приходит по алфавиту (для выбора).
  const scored = teams.filter((t) => t.score !== null).sort((a, b) => (a.place ?? 0) - (b.place ?? 0) || a.name.localeCompare(b.name));
  const total = scored.reduce((s, t) => s + (t.score ?? 0), 0);

  return (
    <div className="mt-6 space-y-6">
      <Text size="sm" muted>
        Начисление идёт в{" "}
        <Link href="/roster" className="font-bold text-[var(--accent-ink)] hover:underline">
          рейтинг команд
        </Link>{" "}
        за текущий турнир. Команд с начислениями: {scored.length}
        {scored.length ? ` · всего ${total} TP` : ""}
      </Text>

      <AwardForm teams={teams} onDone={refresh} />

      {/* Зачёт: кому сколько уже начислено — та же цифра и то же место, что на витрине. */}
      <Card variant="tight">
        {scored.length === 0 ? (
          <Text size="sm" muted>
            Пока никому не начисляли — в рейтинге у всех команд прочерк.
          </Text>
        ) : (
          <div className="divide-y divide-[var(--hairline,rgba(255,255,255,0.08))]">
            {scored.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2">
                <span className="w-6 shrink-0 text-center font-black tabular-nums text-muted">{t.place}</span>
                <span className="min-w-0 flex-1 truncate font-bold">{t.name}</span>
                <span className="shrink-0 font-black tabular-nums text-[var(--accent-ink)]">{t.score} TP</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="space-y-2">
        <Text size="sm" muted>
          Журнал начислений за турнир
        </Text>
        <Card variant="tight">
          {ledger.length === 0 ? (
            <Text size="sm" muted>
              Начислений ещё не было.
            </Text>
          ) : (
            <div className="divide-y divide-[var(--hairline,rgba(255,255,255,0.08))]">
              {ledger.map((r) => (
                <LedgerLine key={r.id} row={r} onDone={refresh} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
