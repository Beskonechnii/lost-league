"use client";

import { FormInput } from "@/components/pouf/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/pouf/select";

// Панель фильтров пула: поиск + разрез по турниру + счётчик найденного. Одна на обе витрины
// (команды и игроки) — до Э8 каждая держала свою копию строки с сырой строкой классов поля,
// и это были два разных поля поиска на соседних вкладках одного раздела.
//
// Селект — китовый (radix + подушка поля), а не нативный: нативный список в Light Clay остаётся
// системным серым, и строка «поиск + фильтр» разъезжалась на два разных элемента управления.

/** «Все турниры» отдельным значением: у radix-селекта нет пункта с пустым value. */
const ALL = "all";

export function FilterBar({
  query,
  onQuery,
  placeholder,
  label,
  options,
  tournament,
  onTournament,
  count,
}: {
  query: string;
  onQuery: (v: string) => void;
  placeholder: string;
  /** Подпись поля поиска для читалки экрана («Поиск команды»). */
  label: string;
  options: { slug: string; label: string }[];
  /** Слаг турнира или "" — все. */
  tournament: string;
  onTournament: (v: string) => void;
  count: string;
}) {
  return (
    // Ширину держат обёртки, а не сами контролы: у поля и триггера селекта в Ките зашит `w-full`
    // (в форме они всегда во всю колонку), и `flex-1` на них же схлопывался бы в отдельную строку.
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-[12rem] flex-1">
        <FormInput
          type="search"
          size="sm"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
        />
      </div>
      <div className="w-[11rem] shrink-0">
        <Select value={tournament || ALL} onValueChange={(v) => onTournament(v === ALL ? "" : v)}>
          <SelectTrigger size="sm" aria-label="Фильтр по турниру">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Все турниры</SelectItem>
            {options.map((o) => (
              <SelectItem key={o.slug} value={o.slug}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <span className="shrink-0 font-pouf text-sm font-bold tabular-nums text-muted">{count}</span>
    </div>
  );
}
