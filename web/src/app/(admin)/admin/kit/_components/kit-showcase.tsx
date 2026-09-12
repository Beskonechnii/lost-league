"use client";

import * as React from "react";
import { SectionHeader } from "@/components/pouf/blocks";
import { Card } from "@/components/pouf/surface";
import { Radio, RadioGroup } from "@/components/pouf/radio";
import { Toggle } from "@/components/pouf/toggle";
import { Calendar, type CalendarDate } from "@/components/pouf/calendar";

/* Витрина атомов Кита: те же компоненты, что уезжают на экраны, живыми — навести мышью,
 * пройти табом, кликнуть. Витрина ПОКАЗЫВАЕТ соответствие коду; источник вида — канвас Кита,
 * ссылка стоит у каждого атома.
 *
 * Новый атом заводится вместе со своей секцией здесь: иначе витрина отстаёт от Кита за пару
 * коммитов и врёт. */

const CANVAS = "https://claude.ai/code/artifact/de74082f-62a9-46ca-b381-b12a204ab6d1";

function Atom({ name, sheet, children }: { name: string; sheet: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-pouf text-xl font-black text-ink">{name}</h2>
        <a
          href={CANVAS}
          target="_blank"
          rel="noreferrer"
          className="font-pouf text-xs font-extrabold text-muted underline underline-offset-4 hover:text-ink"
        >
          лист канваса: {sheet}
        </a>
      </div>
      <Card variant="tight">
        <div className="flex flex-wrap items-start gap-x-10 gap-y-6">{children}</div>
      </Card>
    </section>
  );
}

function Case({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    // min-w-0 + max-w-full: без них колонка с календарём берёт ширину по содержимому (320px)
    // и на 390px вылезает за карточку вместе со страницей.
    <div className="min-w-0 max-w-full space-y-2">
      <div className="font-pouf text-[10px] font-extrabold uppercase tracking-[0.4px] text-muted">{caption}</div>
      {children}
    </div>
  );
}

const FORMATS = [
  { value: "single", label: "Single Elimination" },
  { value: "double", label: "Double Elimination" },
  { value: "robin", label: "Round Robin" },
];

export function KitShowcase() {
  const [format, setFormat] = React.useState("single");
  const [live, setLive] = React.useState(true);
  const [day, setDay] = React.useState<CalendarDate | null>({ y: 2001, m: 3, d: 12 });

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Кит элементов"
        title="Атомы в коде"
        aside="Состояния живые: наведите мышью, пройдите табом."
      />

      <Atom name="Radio" sheet="Radio">
        <Case caption="Группа">
          <RadioGroup className="space-y-3.5" aria-label="Формат сетки" value={format} onValueChange={setFormat}>
            {FORMATS.map((f) => (
              <div key={f.value} className="flex items-center gap-3">
                <Radio value={f.value} id={`fmt-${f.value}`} />
                <label htmlFor={`fmt-${f.value}`} className="text-[14px] font-extrabold text-ink">
                  {f.label}
                </label>
              </div>
            ))}
          </RadioGroup>
        </Case>
        <Case caption="Не выбран">
          <RadioGroup aria-label="Радио: не выбран" value="">
            <Radio value="a" />
          </RadioGroup>
        </Case>
        <Case caption="Выбран">
          <RadioGroup aria-label="Радио: выбран" value="a">
            <Radio value="a" />
          </RadioGroup>
        </Case>
        <Case caption="Disabled">
          <RadioGroup aria-label="Радио: выключен" value="">
            <Radio value="a" disabled />
          </RadioGroup>
        </Case>
      </Atom>

      <Atom name="Тумблер" sheet="Toggle">
        <Case caption="Живой">
          <Toggle label="Показывать завершённые" checked={live} onCheckedChange={setLive} />
        </Case>
        <Case caption="Off">
          <Toggle checked={false} aria-label="Тумблер: выключен" />
        </Case>
        <Case caption="On">
          <Toggle checked aria-label="Тумблер: включён" />
        </Case>
        <Case caption="Disabled">
          <Toggle checked disabled aria-label="Тумблер: недоступен" />
        </Case>
      </Atom>

      <Atom name="Календарь" sheet="Calendar">
        <Case caption="Месяц">
          <Calendar
            className="w-[320px] max-w-full"
            value={day}
            onPick={(y, m, d) => setDay({ y, m, d })}
            years={Array.from({ length: 30 }, (_, i) => 2010 - i)}
          />
        </Case>
        <Case caption="Выбранная дата">
          <div className="font-pouf text-[14px] font-extrabold tabular-nums text-ink">
            {day ? `${String(day.d).padStart(2, "0")}.${String(day.m).padStart(2, "0")}.${day.y}` : "не выбрана"}
          </div>
        </Case>
      </Atom>
    </div>
  );
}
