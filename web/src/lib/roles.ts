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

/**
 * Роль по ответу человека в боте: подпись кнопки («Керри»), английское имя («Mid») или просто
 * номер позиции («2»). Живёт здесь, а не в квизе: по ней спрашивают позицию и заявка команды
 * (tg-quiz.ts), и регистрация игрока (tg-register.ts) — второго разбора одного и того же быть не должно.
 */
export function roleByAnswer(text: string): RoleKey | null {
  const answer = text.trim().toLowerCase();
  const position = Number(answer);
  const role = ROLES.find(
    (r) =>
      r.short.toLowerCase() === answer ||
      r.label.toLowerCase() === answer ||
      (Number.isInteger(position) && r.position === position),
  );
  return (role?.key as RoleKey | undefined) ?? null;
}

/** Индекс для сортировки состава: керри → … → хард, потом замены и тренер. */
export const roleOrder = (v: string | null | undefined) => {
  const i = ROLES.findIndex((r) => r.key === v);
  return i === -1 ? ROLES.length : i;
};

/**
 * Несколько ролей одной строкой — так они лежат у записи на индивидуальный турнир
 * (`TournamentRegistration.desiredRoles`, ТЗ 38): CSV ключей, а не связь и не JSON.
 * Разбор и сборка живут здесь по той же причине, что и `roleByAnswer`, — второго разбора
 * одного и того же быть не должно.
 *
 * Мусор молча отбрасывается: строку пишет форма, а не код, и падать из-за чужого ключа
 * записи нельзя. Порядок всегда канонический (керри → … → тренер), чтобы подпись читалась
 * одинаково, как бы человек ни щёлкал чипы.
 */
export const parseRoleKeys = (csv: string | null | undefined): RoleKey[] => sortRoles((csv ?? "").split(","));

export const joinRoleKeys = (keys: readonly (string | null | undefined)[]): string => sortRoles(keys).join(",");

const sortRoles = (keys: readonly (string | null | undefined)[]): RoleKey[] =>
  [...new Set(keys.map((k) => k?.trim()).filter(isRole))].sort((a, b) => roleOrder(a) - roleOrder(b));

// ── основные роли игрока (Player.mainRoles, ТЗ 41) ────────────────────────────
//
// То же хранение (CSV ключей), но своё правило: их не больше двух и правит их сам игрок.

/** Сколько ролей человек может назвать основными. */
export const MAIN_ROLES_MAX = 2;

/** Отмеченное в форме (`formData.getAll`) → роли: мусор отброшен, порядок канонический.
 *  Пара к `parseRoleKeys`, которая делает то же самое из строки хранения. */
export const roleKeys = (keys: readonly (string | null | undefined)[]): RoleKey[] => sortRoles(keys);

/** Один текст на анкету, кабинет и сервер: лишнее не сохраняется молча. */
export const TOO_MANY_ROLES = "Не больше двух ролей — лишние не сохранены";

/** Сутки между правками ролей в кабинете. Первое заполнение (анкета, апрув, бот) не в счёт. */
const MAIN_ROLES_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Почему править роли сейчас нельзя — текстом, либо null. Время в часах и с округлением вверх
 * (решение Стаса 24.09.2026): «через 6 ч.» человек читает сразу, а точную дату всё равно
 * пересчитывает. Меньше часа осталось — «через 1 ч.», ноль часов ждать не просят.
 */
export function mainRolesRefusal(changedAt: Date | null | undefined, now: Date = new Date()): string | null {
  if (!changedAt) return null;
  const left = MAIN_ROLES_COOLDOWN_MS - (now.getTime() - changedAt.getTime());
  if (left <= 0) return null;
  return `Роли уже менялись сегодня. Следующая правка — через ${Math.max(1, Math.ceil(left / 3_600_000))} ч.`;
}
