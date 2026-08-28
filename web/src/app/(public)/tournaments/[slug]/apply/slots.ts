import { ROLES, roleShort } from "@/lib/roles";

// Раскладка слотов состава и формат, в котором экран отдаёт собранное на сервер. Общий модуль:
// его тянут и клиентская доска, и server-action — иначе ключи слотов разъехались бы на первой правке.
// Ничего серверного здесь нет специально.

export type Slot = {
  /** Ключ слота: он же id для drag-and-drop и ключ в состоянии доски. */
  key: string;
  /** Роль, которая уедет в заявку. У замен слотов два, а роль одна — отсюда и отдельный ключ. */
  role: string;
  label: string;
  /** Позиция 1–5: такие слоты и составляют основу, по ним считается «пятеро в составе». */
  core: boolean;
};

const core: Slot[] = ROLES.filter((r) => r.position !== null).map((r) => ({
  key: r.key,
  role: r.key,
  label: `Поз. ${r.position} · ${r.short}`,
  core: true,
}));

/**
 * Пять позиций, две замены и тренер — та же восьмёрка, что была строками старой формы: пятёрка
 * закрывает состав, остальное добирают почти всегда в этом объёме.
 */
export const SLOTS: Slot[] = [
  ...core,
  { key: "standin-1", role: "standin", label: roleShort("standin") ?? "Замена", core: false },
  { key: "standin-2", role: "standin", label: roleShort("standin") ?? "Замена", core: false },
  { key: "coach", role: "coach", label: roleShort("coach") ?? "Тренер", core: false },
];

export const CORE_KEYS = core.map((s) => s.key);

/**
 * Разложить строки состава по слотам доски. Слот — по роли, а если он занят, берём соседний той же
 * природы (основа к основе, замена к замене), последний запас — любой пустой: потерять человека из
 * состава хуже, чем показать не на своём месте — это видно и правится мышью. Одно правило и для
 * восстановления прежней заявки (`toSlots`), и для готового состава капитана (`captainReadyTeams`).
 */
export function placeByRole(rows: { id: number; role: string | null; isCaptain: boolean }[]) {
  const slots: Record<string, number | null> = Object.fromEntries(SLOTS.map((s) => [s.key, null]));
  let captainId: number | null = null;
  for (const row of rows) {
    const prefer = CORE_KEYS.includes(row.role ?? "")
      ? [row.role as string, ...CORE_KEYS]
      : row.role === "coach"
        ? ["coach", "standin-1", "standin-2"]
        : ["standin-1", "standin-2", "coach"];
    const key = prefer.find((k) => !slots[k]) ?? SLOTS.find((s) => !slots[s.key])?.key;
    if (!key) continue;
    slots[key] = row.id;
    if (row.isCaptain) captainId = row.id;
  }
  return { slots, captainId };
}

/** Что уходит в server-action: состав слотами, а не строками ввода — игроки берутся только из пула. */
export type RosterInput = {
  name: string;
  tag: string;
  divisionId: number | null;
  /** Заполненные слоты; порядок — как в `SLOTS`. */
  players: { playerId: number; role: string; isCaptain: boolean }[];
};
