"use client";

import { useState } from "react";
import { Button } from "@/components/pouf/Button";
import { Field, FormSelect } from "@/components/pouf/Input";
import { Alert } from "@/components/pouf/feedback";
import { PillButton, PillTrack } from "@/components/pouf/tabs";
import { Eyebrow } from "@/components/pouf/text";
import { buildPool, newFearless, tossCoin, type FearlessState, type TeamIdx } from "@/lib/fearless";
import { Panel } from "../../../_components/panel";
import type { HeroRef, TeamRef } from "./types";

/**
 * Экран перед драфтом: две команды, формат серии, монетка и её итог.
 *
 * Разбит на три панели служебной части (`Panel`), а не на одну колонку подряд: до Э11b
 * это был столбик из подписей `text-[13px] uppercase`, голого `<select>` и трёх рядов
 * самодельных кнопок — то есть три разных ответа на один вопрос «выбери одно из
 * нескольких» на одном экране. Теперь выбор из равных вариантов везде говорит одним
 * словом Кита — вдавленная дорожка с пилюлями (`PillTrack`).
 *
 * H1 здесь нет: заголовок и крошки рисует страница (`AdminHeader`), иначе на экране
 * стояло бы два первых заголовка подряд (UI-GUIDELINES §4).
 */

const BEST_OF = [1, 2, 3, 5];

export function FearlessSetup({
  teams,
  heroes,
  onStart,
}: {
  teams: TeamRef[];
  heroes: HeroRef[];
  onStart: (s: FearlessState) => void;
}) {
  const [aId, setAId] = useState<number | null>(teams[0]?.id ?? null);
  const [bId, setBId] = useState<number | null>(teams[1]?.id ?? null);
  const [bestOf, setBestOf] = useState(3);
  const [coin, setCoin] = useState<TeamIdx | null>(null); // кто выиграл бросок
  const [firstPick, setFirstPick] = useState<TeamIdx>(0);
  const [radiant, setRadiant] = useState<TeamIdx>(0);

  const a = teams.find((t) => t.id === aId);
  const b = teams.find((t) => t.id === bId);
  const ready = a && b && a.id !== b.id;
  const names: [string, string] = [a?.name ?? "Команда A", b?.name ?? "Команда B"];

  const start = () => {
    if (!a || !b) return;
    const pool = buildPool(heroes.map((h) => ({ id: h.id, attr: h.attr })));
    onStart(
      newFearless([{ name: a.name, color: a.color }, { name: b.name, color: b.color }], {
        bestOf,
        pool,
        firstPick,
        radiant,
      }),
    );
  };

  return (
    // Ширину колонки держит оболочка борда (`fearless-board.tsx`): полоса сессии стоит над
    // этими панелями и обязана быть с ними одной ширины.
    <div className="space-y-4">
      <Panel
        title="Участники"
        hint="Две разные команды. Цвет команды берётся из её карточки в ростере — им же подсвечены ходы на борде."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TeamPick label="Команда A" teams={teams} value={aId} onChange={setAId} exclude={bId} />
          <TeamPick label="Команда B" teams={teams} value={bId} onChange={setBId} exclude={aId} />
        </div>
      </Panel>

      <Panel title="Формат серии" hint="Сколько карт максимум. Стороны и первый пик чередуются по картам.">
        <div className="max-w-[18rem]">
          <PillTrack label="Формат серии">
            {BEST_OF.map((n) => (
              <PillButton key={n} active={bestOf === n} variant="quiet" onClick={() => setBestOf(n)}>
                Bo{n}
              </PillButton>
            ))}
          </PillTrack>
        </div>
      </Panel>

      {/* Монетка: бросок случаен, победитель выбирает один блок — сторону ИЛИ очередь;
          второе достаётся сопернику. Итог оператор вводит двумя дорожками ниже. */}
      <Panel
        title="Монетка"
        hint="Победитель броска выбирает одно: сторону или очередь. Второе идёт сопернику — отметьте итог обеими дорожками."
        aside={
          <Button variant="quiet" size="sm" onClick={() => setCoin(tossCoin())}>
            Бросить монетку
          </Button>
        }
      >
        {coin !== null && (
          <Alert tone="info" block className="mb-4">
            Выиграла <b>{names[coin]}</b> — выбирает сторону или очередь, второе идёт сопернику.
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <PickTwo label="Первый пик (FP)" names={names} value={firstPick} onChange={setFirstPick} />
          <PickTwo label="Свет (Radiant)" names={names} value={radiant} onChange={setRadiant} />
        </div>
      </Panel>

      <div className="flex flex-wrap items-center gap-3">
        <Button tone="orange" disabled={!ready} onClick={start}>
          Начать драфт
        </Button>
        {!ready && <Alert tone="warn">Выберите две разные команды.</Alert>}
      </div>
    </div>
  );
}

/** Выбор одной из двух команд. Названия — данные, поэтому пилюли режутся по месту. */
function PickTwo({
  label,
  names,
  value,
  onChange,
}: {
  label: string;
  names: [string, string];
  value: TeamIdx;
  onChange: (v: TeamIdx) => void;
}) {
  return (
    <div>
      <Eyebrow className="mb-1.5">{label}</Eyebrow>
      <PillTrack label={label}>
        {([0, 1] as TeamIdx[]).map((i) => (
          <PillButton key={i} active={value === i} variant="quiet" onClick={() => onChange(i)} className="min-w-0">
            <span className="truncate">{names[i]}</span>
          </PillButton>
        ))}
      </PillTrack>
    </div>
  );
}

/** Команда из ростера. `FormSelect`, а не китовый `Select`: список длинный (все команды
 *  лиги), и родной `<select>` на телефоне открывается системным барабаном. */
function TeamPick({
  label,
  teams,
  value,
  onChange,
  exclude,
}: {
  label: string;
  teams: TeamRef[];
  value: number | null;
  onChange: (id: number) => void;
  exclude: number | null;
}) {
  return (
    <Field label={label}>
      {(id) => (
        <FormSelect id={id} size="sm" value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))}>
          {teams.map((t) => (
            <option key={t.id} value={t.id} disabled={t.id === exclude}>
              {t.name}
            </option>
          ))}
        </FormSelect>
      )}
    </Field>
  );
}
