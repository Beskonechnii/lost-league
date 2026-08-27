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

/** Что уходит в server-action: состав слотами, а не строками ввода — игроки берутся только из пула. */
export type RosterInput = {
  name: string;
  tag: string;
  divisionId: number | null;
  /** Заполненные слоты; порядок — как в `SLOTS`. */
  players: { playerId: number; role: string; isCaptain: boolean }[];
};
