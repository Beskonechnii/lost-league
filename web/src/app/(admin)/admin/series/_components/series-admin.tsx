"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import type { SeriesRow } from "@/lib/series";
import { BRACKETS } from "@/lib/stages";
import { Button } from "@/components/pouf/Button";
import { FormInput } from "@/components/pouf/Input";
import { EmptyState } from "@/components/pouf/feedback";
import { PillButton } from "@/components/pouf/tabs";
import { Toolbar, ToolbarActions, ToolbarFilter, ToolbarSearch } from "@/components/pouf/toolbar";
import { SeriesCard } from "./series-card";
import { NewSeriesForm } from "./series-form";
import type { DivOpt, SlotOptions, TeamOpt } from "./types";

export type { SlotOption, SlotOptions } from "./types";

/* Оболочка архива: дивизион, поиск, фильтр карт, вкладки подраздела и сетка карточек.
 *
 * На Э9 файл разобран с 679 строк до трёх (`RELEASE-PLAN.md` §C4): карточка встречи уехала в
 * `series-card.tsx`, форма заведения — в `series-form.tsx`, общие типы — в `types.ts`. Здесь
 * осталось ровно то, что отвечает за «какой список показать».
 *
 * Разрезы — пилюли Кита, а не `Segmented`: у сегмента выбранный вариант ВДАВЛЕН, а вдавленность
 * в Ките означает нажатие, не выбор (решение Э8, `pouf/tabs.tsx`). Рядом на этой же странице
 * стоят вкладки подраздела, и два разных ответа на вопрос «где я» на одном экране — это то,
 * что Э8 и убирал.
 *
 * H1 страницы здесь больше нет: заголовок и крошки рисует сама страница (`AdminHeader`), иначе
 * компонент списка держал бы второй H1 в обход `SectionHeader` (UI-GUIDELINES §4).
 */

/** Порядок половин сетки для сортировки плей-оффа: верхняя → нижняя → гранд. */
const bracketOrder = (b: string | null) => BRACKETS.findIndex((x) => x.key === b);

export function SeriesAdmin({
  divisions,
  statsHref,
  teams,
  series,
  slots,
}: {
  divisions: DivOpt[];
  /** Куда ведёт «статистика»: раздел дивизиона живёт внутри турнира, слаг знает только сервер. */
  statsHref: string;
  teams: TeamOpt[];
  series: SeriesRow[];
  slots: SlotOptions;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  // Дивизион — верхний разрез (как в ростере команд): D1 и D2 играют раздельно, поэтому список
  // всегда показывает ровно один дивизион. Он же — дивизион по умолчанию в форме новой встречи.
  const [division, setDivision] = useState(divisions[0]?.id ?? 0);
  // Форма новой встречи держалась раскрытой всегда и занимала пол-экрана над списком, ради которого
  // сюда и приходят. Прячем её за кнопку и показываем боковым sheet по клику.
  const [showForm, setShowForm] = useState(false);

  // Встреч под сотню (вся групповая стадия двух дивизионов), поэтому список без разбивки
  // бесполезен: оператор приходит сюда за одной конкретной серией.
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "withGames" | "empty">("all");
  // Подраздел внутри дивизиона: группа A/B, плей-офф — или всё, что не легло в них («Прочее»).
  // Набор вкладок строится из данных, поэтому новая группа или стадия появляется в интерфейсе сама.
  const [sub, setSub] = useState<string>("g:A");

  const textMatch = (s: SeriesRow) => {
    if (only === "withGames" && s.games.length === 0) return false;
    if (only === "empty" && s.games.length > 0) return false;
    if (!q.trim()) return true;
    const text = `${s.home.name} ${s.away.name} ${s.home.tag} ${s.away.tag} ${s.round ?? ""}`.toLowerCase();
    return text.includes(q.trim().toLowerCase());
  };

  // Встречи активного дивизиона — база для вкладок подраздела и для списка.
  const inDivision = series.filter((s) => s.divisionId === division);

  // Вкладки подраздела строим по факту: сколько групп есть — столько вкладок «Группа X»,
  // плюс «Плей-офф», плюс «Прочее» для всего, что не групповая стадия и не плей-офф.
  const isOther = (s: SeriesRow) => s.stage !== "group" && s.stage !== "playoff";
  const groups = [...new Set(inDivision.filter((s) => s.stage === "group").map((s) => s.group ?? "—"))].sort();
  const subTabs = [
    ...groups.map((g) => ({ key: `g:${g}`, label: `Группа ${g}`, test: (s: SeriesRow) => s.stage === "group" && (s.group ?? "—") === g })),
    ...(inDivision.some((s) => s.stage === "playoff") ? [{ key: "playoff", label: "Плей-офф", test: (s: SeriesRow) => s.stage === "playoff" }] : []),
    ...(inDivision.some(isOther) ? [{ key: "other", label: "Прочее", test: isOther }] : []),
  ];
  const activeSub = subTabs.find((t) => t.key === sub) ?? subTabs[0];

  // Список: встречи активного дивизиона и подраздела, прошедшие текст-фильтр. Плей-офф сортируем
  // по половине сетки (верхняя → нижняя → гранд), чтобы стадии шли в турнирном порядке.
  const rows = inDivision
    .filter((s) => (activeSub ? activeSub.test(s) : true) && textMatch(s))
    .sort((a, b) => (activeSub?.key === "playoff" ? bracketOrder(a.bracket) - bracketOrder(b.bracket) : 0));

  const onlyOptions: { value: "all" | "withGames" | "empty"; label: string }[] = [
    { value: "all", label: "Все" },
    { value: "withGames", label: "С картами" },
    { value: "empty", label: "Без карт" },
  ];

  return (
    <div className="space-y-4">
      <NewSeriesForm
        open={showForm}
        onOpenChange={setShowForm}
        divisions={divisions}
        teams={teams}
        slots={slots}
        division={division}
        onDivision={setDivision}
        onCreated={refresh}
      />

      {/* Полоса инструментов Кита: дивизион и поиск слева, «завести встречу» справа. */}
      <Toolbar>
        <div className="flex flex-wrap gap-2">
          {divisions.map((d) => (
            <PillButton
              key={d.id}
              active={division === d.id}
              size="md"
              onClick={() => setDivision(d.id)}
            >
              {d.label}
              <span className="ml-1.5 text-xs tabular-nums opacity-70">
                {series.filter((s) => s.divisionId === d.id).length}
              </span>
            </PillButton>
          ))}
        </div>
        <ToolbarSearch>
          <FormInput
            type="search"
            size="sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по командам"
            aria-label="Поиск по командам"
          />
        </ToolbarSearch>
        <ToolbarFilter w="auto">
          <div className="flex flex-wrap gap-2">
            {onlyOptions.map((o) => (
              <PillButton key={o.value} active={only === o.value} onClick={() => setOnly(o.value)}>
                {o.label}
              </PillButton>
            ))}
          </div>
        </ToolbarFilter>
        <ToolbarActions>
          <span className="text-sm font-bold text-muted">
            Карты идут в{" "}
            <Link href={statsHref} className="font-black text-[var(--accent-ink)] hover:underline">
              статистику
            </Link>
          </span>
          <Button size="sm" onClick={() => setShowForm(true)}>Завести встречу</Button>
        </ToolbarActions>
      </Toolbar>

      {/* Подраздел внутри дивизиона: группы и плей-офф. Счётчик — по дивизиону, без учёта текста. */}
      {subTabs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {subTabs.map((t) => (
            <PillButton
              key={t.key}
              active={(activeSub?.key ?? sub) === t.key}
              onClick={() => setSub(t.key)}
            >
              {t.label}
              <span className="ml-1.5 text-xs tabular-nums opacity-70">{inDivision.filter(t.test).length}</span>
            </PillButton>
          ))}
        </div>
      )}

      {/* Плитки в адаптивной сетке: 1 колонка на узком, 2 на среднем, 3 на широком.
          Без items-start — грид растягивает плитки в ряду до общей высоты (однородный вид);
          строку «Привязать» внутри карточки прижимает к низу mt-auto. */}
      {rows.length === 0 ? (
        <EmptyState icon="calendar" title="Встреч в этом разделе нет">
          {inDivision.length === 0
            ? "В дивизионе ещё ни одной встречи — заведите первую кнопкой справа сверху."
            : "Ни одна встреча не прошла фильтр: снимите поиск или разрез по картам."}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {/* Время начала в ключе: поле «начало» — состояние карточки, и после апрува предложения
              капитанов (оно приходит с сервера, а не из этой формы) карточка обязана перечитать его.
              Иначе поле остаётся пустым, а «сохранить» рядом с ним снесло бы только что назначенное. */}
          {rows.map((s) => (
            <SeriesCard key={`${s.id}:${s.startAt?.getTime() ?? 0}`} s={s} onChange={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
