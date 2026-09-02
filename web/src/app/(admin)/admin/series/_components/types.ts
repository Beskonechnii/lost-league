/* Общие типы архива серий. Вынесены из `series-admin.tsx` при его разборе на Э9
 * (`RELEASE-PLAN.md` §C4): их знают все три части — оболочка со списком, карточка
 * встречи и форма заведения, — и держать их в одном из трёх файлов значило бы
 * сделать этот файл главным без причины.
 */

/** Команда для выпадающих списков формы. Дивизион — из участия в турнире, а не из поля команды. */
export type TeamOpt = { id: number; name: string; tag: string; divisionId: number | null };

/** Дивизион турнира: `label` — подпись раздела («LOST D1»), она же на вкладке. */
export type DivOpt = { id: number; name: string; label: string };

/** Слот сетки для формы: подпись, команды (когда известны) и «занят ли». Считается на сервере. */
export type SlotOption = {
  key: string;
  label: string;
  round: string;
  bestOf: 3 | 5;
  aTeamId: number | null;
  bTeamId: number | null;
  aName: string;
  bName: string;
  taken: boolean;
};

/** Слоты сетки по id дивизиона: имена дивизионов в разных турнирах совпадают, id — нет. */
export type SlotOptions = Record<number, SlotOption[]>;

/** Счета серии Bo3 по умолчанию — форма сузит их до допустимых для Bo выбранного слота. */
export const SCORES = ["2:0", "2:1", "1:2", "0:2"];

/** Дата в вид, который понимает <input type="datetime-local">: локальное время без зоны. */
export function forInput(value: Date | string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
