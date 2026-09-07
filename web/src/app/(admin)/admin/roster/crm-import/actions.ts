"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/account";
import { parseCrmDelimited, parseCrmGrid, parseCrmJson } from "@/lib/crm-import";
import { matchCrmRows, applyCrmChanges, type CrmMatch } from "@/lib/crm-match";
import { readWorkbook } from "@/lib/xlsx";

// Мастер импорта CRM: тот же трёхшаговый порядок, что у мастера составов
// (admin/tournaments/[slug]/import) — источник → разбор → запись, разбор отделён от записи, чтобы
// оператор увидел, что именно изменится, до того как это попадёт в профили. В отличие от составов —
// это только ОБОГАЩЕНИЕ существующих игроков (телеграм, ДР, город, account_id): новых профилей не
// заводит, поэтому право на запись — `roster.edit`, а не `tournaments.edit`.
//
// Разбор и свод с базой — одно действие, не два: в отличие от «Подтянуть данные» у мастера составов
// (тот ходит в сеть за Steam/OpenDota и может занять минуту), свод CRM — один запрос к своей же БД.

async function fetchSheet(src: string): Promise<Uint8Array> {
  const id = src.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1] ?? src.trim();
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`);
  if (!res.ok) throw new Error(`Не удалось скачать таблицу (${res.status}). Открыт ли доступ по ссылке?`);
  return new Uint8Array(await res.arrayBuffer());
}

export type ParseState = {
  matches?: CrmMatch[];
  unmatched?: string[];
  unchanged?: number;
  error?: string;
  note?: string;
} | null;

export async function parseCrmUpload(_prev: ParseState, form: FormData): Promise<ParseState> {
  await requirePermission("roster.edit");
  try {
    const file = form.get("file");
    const link = String(form.get("link") ?? "").trim();
    const pasted = String(form.get("pasted") ?? "").trim();
    const tab = String(form.get("tab") ?? "").trim().toLowerCase();
    const force = form.get("force") === "on";

    const fromSheets = (bytes: Uint8Array) => {
      const sheets = readWorkbook(bytes).filter((s) => !tab || s.name.toLowerCase().includes(tab));
      if (sheets.length === 0) throw new Error("Такой вкладки нет в книге");
      for (const s of sheets) {
        try {
          return parseCrmGrid(s.grid);
        } catch {
          continue; // на этом листе шапки нет — пробуем следующий
        }
      }
      throw new Error(`Ни на одной вкладке не нашлась шапка с колонкой ника. Вкладки: ${sheets.map((s) => s.name).join(", ")}`);
    };

    let rows;
    let note = "";
    if (file instanceof File && file.size > 0) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (/\.xlsx$/i.test(file.name)) rows = fromSheets(bytes);
      else if (/\.json$/i.test(file.name)) rows = parseCrmJson(JSON.parse(new TextDecoder().decode(bytes)));
      else rows = parseCrmDelimited(new TextDecoder().decode(bytes));
      note = `Файл ${file.name}`;
    } else if (link) {
      rows = fromSheets(await fetchSheet(link));
      note = "Гугл-таблица";
    } else if (pasted) {
      rows = parseCrmDelimited(pasted);
      note = "Вставленный текст";
    } else {
      return { error: "Дайте файл, ссылку на таблицу или вставьте текст" };
    }

    if (rows.length === 0) return { error: "Анкет не нашлось" };
    const result = await matchCrmRows(rows, { force });
    return { ...result, note: `${note} · анкет: ${rows.length}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось разобрать файл" };
  }
}

export type SaveState = { updated?: number; fields?: number; error?: string } | null;

export async function saveCrmMatches(_prev: SaveState, form: FormData): Promise<SaveState> {
  await requirePermission("roster.edit");
  try {
    const matches = JSON.parse(String(form.get("matches") ?? "[]")) as CrmMatch[];
    const picked = new Set(form.getAll("pick").map(Number));
    if (picked.size === 0) return { error: "Не отмечено ни одного игрока" };

    const result = await applyCrmChanges(matches, picked);
    revalidatePath("/roster/players");
    return result;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось записать правки" };
  }
}
