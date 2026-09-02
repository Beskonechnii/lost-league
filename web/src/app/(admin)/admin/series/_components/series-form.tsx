"use client";

import { useState } from "react";
import { STAGES } from "@/lib/stages";
import { validScores } from "@/lib/playoff-bracket";
import { Button } from "@/components/pouf/Button";
import { Label } from "@/components/pouf/Input";
import { Alert } from "@/components/pouf/feedback";
import { Sheet } from "@/components/pouf/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/pouf/select";
import { SCORES, type DivOpt, type SlotOptions, type TeamOpt } from "./types";

/* Форма заведения встречи — боковой Sheet. Отделена от списка при разборе
 * `series-admin.tsx` (`RELEASE-PLAN.md` §C4): у неё шесть собственных состояний,
 * которые список не читает вовсе, и держать их вместе значило перечитывать всё
 * ради правки любой половины.
 *
 * Выпадающие списки — китовый `Select` (radix + подушка поля). До Э9 здесь стоял
 * самодельный `PoufSelect` поверх `DropdownMenu` с комментарием «у них нет
 * shadcn-подобного Select»: он неверен с Э3 — `components/pouf/select.tsx` есть,
 * и на нём же собраны фильтры ростера. Значение живёт в состоянии клиента и
 * уходит через fetch, а не через FormData, поэтому именно `Select`, а не
 * `FormSelect` (правило выбора — в шапке `FormSelect`).
 */

/** Подпись + контрол в столбик: панель уже центральной модалки, в строку они не встают. */
function Labeled({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export function NewSeriesForm({
  open,
  onOpenChange,
  divisions,
  teams,
  slots,
  division,
  onDivision,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  divisions: DivOpt[];
  teams: TeamOpt[];
  slots: SlotOptions;
  /** Дивизион общий со списком: форма заводит встречу в тот, что открыт на экране. */
  division: number;
  onDivision: (id: number) => void;
  onCreated: () => void;
}) {
  const [stage, setStage] = useState<string>("group");
  const [group, setGroup] = useState("A");
  const [slot, setSlot] = useState("");
  const [homeId, setHomeId] = useState("");
  const [awayId, setAwayId] = useState("");
  const [score, setScore] = useState(SCORES[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Слоты сетки выбранного дивизиона и выбранный слот; счёт ограничен его Bo (гранд-финал — Bo5).
  const divSlots = slots[division] ?? [];
  const selSlot = divSlots.find((s) => s.key === slot) ?? null;
  const scoreOptions = stage === "playoff" && selSlot ? validScores(selSlot.bestOf) : SCORES;

  // Команды показываем только своего дивизиона: D1 и D2 играют раздельно, перемешать их — ошибка.
  const options = teams.filter((t) => !t.divisionId || t.divisionId === division);

  // Выбор слота подставляет команды из сетки (когда исход предыдущего раунда уже известен) —
  // оператору остаётся только счёт. Счёт сбрасываем на первый допустимый для Bo слота.
  const pickSlot = (key: string) => {
    setSlot(key);
    const s = divSlots.find((x) => x.key === key);
    if (s) {
      if (s.aTeamId) setHomeId(String(s.aTeamId));
      if (s.bTeamId) setAwayId(String(s.bTeamId));
      setScore(validScores(s.bestOf)[0]);
    }
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        divisionId: division,
        stage,
        group: stage === "group" ? group : null,
        slot: stage === "playoff" ? slot : null,
        homeId: Number(homeId),
        awayId: Number(awayId),
        score,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!json.ok) return setError(json.error ?? "Не вышло");
    setHomeId("");
    setAwayId("");
    onOpenChange(false);
    onCreated();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Новая встреча">
      <div className="flex flex-col gap-4 font-pouf">
        <Labeled label="Дивизион">
          <Select value={String(division)} onValueChange={(v) => onDivision(Number(v))}>
            <SelectTrigger size="sm" aria-label="Дивизион">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {divisions.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Labeled>

        <Labeled label="Стадия">
          <Select
            value={stage}
            onValueChange={(v) => {
              setStage(v);
              // При переходе в плей-офф сразу берём первый свободный слот сетки — с командами.
              if (v === "playoff" && !slot) pickSlot((divSlots.find((s) => !s.taken) ?? divSlots[0])?.key ?? "");
            }}
          >
            <SelectTrigger size="sm" aria-label="Стадия">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAGES.map((s) => (
                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Labeled>

        {stage === "group" ? (
          <Labeled label="Группа">
            <Select value={group} onValueChange={setGroup}>
              <SelectTrigger size="sm" aria-label="Группа">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["A", "B"].map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Labeled>
        ) : (
          <Labeled label="Слот сетки">
            {/* половину сетки и раунд не спрашиваем: их задаёт слот (см. src/lib/playoff-bracket.ts) */}
            <Select value={slot} onValueChange={pickSlot}>
              <SelectTrigger size="sm" aria-label="Слот сетки">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {divSlots.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {`${s.label} · ${s.aName} — ${s.bName}${s.taken ? " (занят)" : ""}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Labeled>
        )}

        <Labeled label="Хозяева">
          <Select value={homeId} onValueChange={setHomeId}>
            <SelectTrigger size="sm" aria-label="Хозяева">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {options.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Labeled>

        <Labeled label="Счёт">
          <Select value={score} onValueChange={setScore}>
            <SelectTrigger size="sm" aria-label="Счёт">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scoreOptions.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Labeled>

        <Labeled label="Гости">
          <Select value={awayId} onValueChange={setAwayId}>
            <SelectTrigger size="sm" aria-label="Гости">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {options.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Labeled>

        <div className="pt-1">
          <Button block onClick={create} disabled={!homeId || !awayId || (stage === "playoff" && !slot)} loading={busy}>
            {busy ? "…" : "Завести"}
          </Button>
        </div>
        {error && <Alert tone="err" block>{error}</Alert>}
      </div>
    </Sheet>
  );
}
