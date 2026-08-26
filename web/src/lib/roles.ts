// Роли в составе. Порядок массива = порядок вывода игроков в составе и в графике.
// В БД (Player.role) хранится ключ; номер позиции — только для подписей вида «поз. 1».

export const ROLES = [
  { key: "carry", label: "Carry", short: "Керри", position: 1 },
  { key: "mid", label: "Mid", short: "Мид", position: 2 },
  { key: "offlane", label: "Offlane", short: "Оффлейн", position: 3 },
  { key: "soft-support", label: "Soft support", short: "Софт-саппорт", position: 4 },
  { key: "hard-support", label: "Hard support", short: "Хард-саппорт", position: 5 },
  { key: "standin", label: "Standin", short: "Замена", position: null },
  { key: "coach", label: "Coach", short: "Тренер", position: null },
] as const;

export type RoleKey = (typeof ROLES)[number]["key"];

const BY_KEY = new Map(ROLES.map((r) => [r.key as string, r]));

export const isRole = (v: string | null | undefined): v is RoleKey => !!v && BY_KEY.has(v);
export const roleLabel = (v: string | null | undefined) => (v && BY_KEY.get(v)?.label) ?? null;
/** Короткая русская подпись («Керри», «Мид») — ей подписаны кнопки и сводки бота. */
export const roleShort = (v: string | null | undefined) => (v && BY_KEY.get(v)?.short) ?? null;
// именно number | null: пустая строка вместо роли не должна протекать в тип позиции
export const rolePosition = (v: string | null | undefined): number | null =>
  (v ? BY_KEY.get(v)?.position : null) ?? null;

/** Роль по номеру позиции 1–5 (в таблице составов роли записаны цифрами). */
export const roleByPosition = (n: number): RoleKey | null =>
  (ROLES.find((r) => r.position === n)?.key as RoleKey | undefined) ?? null;

/** Индекс для сортировки состава: керри → … → хард, потом замены и тренер. */
export const roleOrder = (v: string | null | undefined) => {
  const i = ROLES.findIndex((r) => r.key === v);
  return i === -1 ? ROLES.length : i;
};
