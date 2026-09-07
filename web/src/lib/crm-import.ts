// Разбор выгрузки CRM → анкеты игроков. Чистый модуль (без БД): его зовут и страница импорта
// в админке, и скрипт scripts/import-crm.ts — свод с базой (кто уже в ростере, что писать)
// живёт отдельно в src/lib/crm-match.ts, там, где есть prisma.
//
// В отличие от разбора составов (roster-import.ts) — это ОБОГАЩЕНИЕ, не заведение: CRM даёт
// то, чего нет в таблице сезона (телеграм, дата рождения, город), а не роли и MMR. Колонки в
// выгрузках CRM называют по-разному, поэтому ищем по подстрокам, а не по точному имени.

import type { Grid } from "./xlsx";

export type CrmField =
  | "nickname"
  | "realName"
  | "lastName"
  | "telegram"
  | "birthday"
  | "city"
  | "country"
  | "accountId"
  | "link";

const HEADERS: [CrmField, RegExp][] = [
  ["nickname", /^ник|nick|псевдоним/i],
  ["lastName", /фамилия|surname|last.?name/i],
  ["realName", /^имя|фио|first.?name|^name/i],
  ["telegram", /телеграм|telegram|\btg\b|\bтг\b|tg@/i],
  ["birthday", /рожден|день\s*рожд|\bдр\b|birth|\bdob\b/i],
  ["city", /город|city|прожива|населённ|населен/i],
  ["country", /стран|country/i],
  ["accountId", /account.?id|dota.?id|steam.?32/i],
  ["link", /steam|стим|dotabuff|stratz|opendota|main\s*db|профил|ссылк|link|profile/i],
];

/** Заголовок ячейки → поле анкеты. Порядок HEADERS важен: «account_id» проверяется раньше «ссылки». */
export function fieldOf(header: string): CrmField | null {
  const h = header.trim();
  if (!h) return null;
  for (const [field, re] of HEADERS) if (re.test(h)) return field;
  return null;
}

export type CrmRow = Partial<Record<Exclude<CrmField, "link">, string>> & { links: string[] };

/**
 * Строки таблицы → анкеты. Ссылочных колонок в CRM несколько (Steam, STEAM 2, Main DB, ЛС на сайте),
 * поэтому собираем их все: id вытащим из первой, которая на профиль, а не на сайт лиги.
 */
export function toCrmRows(header: string[], body: { text: string; href?: string | null }[][]): CrmRow[] {
  const map = header.map(fieldOf);
  if (!map.includes("nickname")) {
    throw new Error(`Не нашёл колонку с ником. Колонки: ${header.filter(Boolean).join(" | ")}`);
  }

  return body
    .map((cells) => {
      const row: CrmRow = { links: [] };
      map.forEach((field, i) => {
        const cell = cells[i];
        if (!field || !cell) return;
        // ссылка может быть и гиперссылкой ячейки, и просто текстом
        const link = cell.href || (/^https?:\/\//i.test(cell.text) ? cell.text : "");
        if (field === "link") {
          if (link) row.links.push(link);
        } else {
          row[field] ??= cell.text || undefined;
          if (link) row.links.push(link);
        }
      });
      return row;
    })
    .filter((r) => r.nickname);
}

/** Строка шапки — первая, где узнали хотя бы две колонки, включая ник. */
function findHeaderRow(rows: { fields: (CrmField | null)[] }[]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const fields = rows[i].fields;
    if (fields.includes("nickname") && fields.filter(Boolean).length >= 2) return i;
  }
  return -1;
}

/** Одна вкладка книги → анкеты. Кидает, если на вкладке не нашлась шапка с колонкой ника. */
export function parseCrmGrid(grid: Grid): CrmRow[] {
  const rows = grid.map((row) => ({ fields: (row ?? []).map((c) => fieldOf(c?.text ?? "")) }));
  const at = findHeaderRow(rows);
  if (at < 0) throw new Error("Не нашлась шапка с колонкой ника на этом листе");
  const header = (grid[at] ?? []).map((c) => c?.text ?? "");
  const body = grid.slice(at + 1).map((row) => (row ?? []).map((c) => ({ text: c?.text ?? "", href: c?.href })));
  return toCrmRows(header, body);
}

/** CSV/TSV: разделитель угадываем по шапке, кавычки — по RFC (удвоенная кавычка внутри поля). */
export function parseCsvGrid(text: string): string[][] {
  const head = text.slice(0, text.indexOf("\n") + 1 || undefined);
  const delim = [";", "\t", ","].sort((a, b) => head.split(b).length - head.split(a).length)[0];

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** Вставленный текст или .csv/.tsv файл → анкеты. */
export function parseCrmDelimited(text: string): CrmRow[] {
  const grid = parseCsvGrid(text);
  const at = grid.findIndex((r) => {
    const fields = r.map(fieldOf);
    return fields.includes("nickname") && fields.filter(Boolean).length >= 2;
  });
  if (at < 0) throw new Error(`Не нашёл шапку с ником. Первая строка: ${grid[0]?.join(" | ") ?? "пусто"}`);
  return toCrmRows(
    grid[at],
    grid.slice(at + 1).map((r) => r.map((text) => ({ text: text.trim() }))),
  );
}

/** .json-выгрузка (массив объектов) → анкеты. */
export function parseCrmJson(data: Record<string, unknown>[]): CrmRow[] {
  if (!Array.isArray(data) || data.length === 0) throw new Error("Ожидал непустой массив объектов в JSON");
  const header = Object.keys(data[0] ?? {});
  return toCrmRows(
    header,
    data.map((o) => header.map((k) => ({ text: String(o[k] ?? "").trim() }))),
  );
}
