"use client";

import type { ReactNode } from "react";
import { FormInput } from "@/components/pouf/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/pouf/select";
import { Toolbar, ToolbarCount, ToolbarFilter, ToolbarSearch } from "@/components/pouf/toolbar";

// Полоса над данными пула: разрезы + поиск + фильтр по турниру + счётчик найденного. Одна на обе
// витрины (команды и игроки) — до Э8 каждая держала свою копию строки с сырой строкой классов поля,
// и это были два разных поля поиска на соседних вкладках одного раздела.
//
// Раскладку держит китовый `Toolbar`: здесь была его копия по классам, собранная тогда, когда атом
// в Ките уже был. Осталась только начинка — поиск живёт в состоянии клиента, поэтому полоса
// продукта не может быть тем же файлом, что полоса админки.
//
// Разрезы («Сквозной / По турнирам», у оператора ещё «В пуле / Архив») приходят готовым узлом
// с серверной страницы: они ссылки, а не состояние клиента, и своей строкой над полосой стояли бы
// вторым рядом управления за один выбор (UI-GUIDELINES §9).
//
// Селект — китовый (radix + подушка поля), а не нативный: нативный список в Light Clay остаётся
// системным серым, и строка «поиск + фильтр» разъезжалась на два разных элемента управления.

/** «Все турниры» отдельным значением: у radix-селекта нет пункта с пустым value. */
const ALL = "all";

export function FilterBar({
  cuts,
  query,
  onQuery,
  placeholder,
  label,
  options,
  tournament,
  onTournament,
  count,
  hideTournament = false,
}: {
  /** Разрезы витрины, отрисованные на сервере: первой группой полосы, слева. */
  cuts?: ReactNode;
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
  /** Разрез «по турнирам» уже режет витрину секциями — второй такой же выбор строкой выше лишний. */
  hideTournament?: boolean;
}) {
  return (
    <Toolbar>
      {/* Раскладка группы — здесь, а не на странице: со страницы приходят сами пилюли, чтобы
          обе витрины не держали по своей копии классов ряда. */}
      {cuts && <div className="flex flex-wrap items-center gap-2">{cuts}</div>}
      <ToolbarSearch>
        <FormInput
          type="search"
          size="sm"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
        />
      </ToolbarSearch>
      {!hideTournament && (
        <ToolbarFilter>
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
        </ToolbarFilter>
      )}
      <ToolbarCount>{count}</ToolbarCount>
    </Toolbar>
  );
}
