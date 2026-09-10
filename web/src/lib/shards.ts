// Только сервер: реестр осколков — начисление, свод и анти-абуз.
//
// Осколки (shards) — вторая валюта лиги. TP остаётся спортивным результатом: его дают за игру,
// зачёт сезонный и живёт в `PointsEntry` с привязкой к турниру. Осколки дают за то, что человек
// сделал в системе — прошёл модерацию, подтвердил Steam, привязал телеграм, заполнил анкету, —
// они копятся за всё время и не обнуляются с сезоном. Это разные вопросы к разным подлежащим,
// поэтому и таблицы разные (подробнее — в комментарии `ShardEntry` в схеме).
//
// ТРАТ ЗДЕСЬ НЕТ. На что осколки тратятся, решается отдельной задачей (решение Стаса 10.09), и
// придумывать магазин на Э22 запрещено. Модель к трате готова заранее: истина — СОБЫТИЯ начисления,
// а не одно число в поле, поэтому расход ляжет отрицательной строкой в ту же таблицу, а грейд
// продолжит считаться по сумме плюсовых строк — потратить и упасть в статусе будет нельзя.
//
// ── Анти-абуз ────────────────────────────────────────────────────────────────────────────────
// Два правила из плана (`RELEASE-PLAN.md` §E3, Э22):
//   1. начисляем ТОЛЬКО аккаунту, прошедшему модерацию (`status = active`). До решения оператора
//      вехи копятся «на бумаге» и оплачиваются разом при апруве;
//   2. ключ уникальности — игровой account_id (steam32), а не id аккаунта лиги. Он и стоит в
//      `ShardEntry.key`, уникальном по всей таблице: второй аккаунт с тем же Steam не получит за
//      ту же веху ничего — ни сразу, ни после перепривязки.
// Без известного account_id не начисляем вовсе: без него нечем отличить второй заход от первого.

import { prisma } from "./prisma";
import { accountIdFromSteamId, playerAccountId, playerGaps } from "./profiles";
import { shardGrade, shardProgress, type ShardGrade, type ShardReason } from "./shard-grades";

/** Что и сколько дают. Числа — здесь и только здесь; витрина берёт их отсюда же. */
export const SHARD_AWARDS: { reason: Exclude<ShardReason, "manual">; amount: number; hint: string }[] = [
  { reason: "welcome", amount: 50, hint: "Дождитесь решения по заявке — вход в лигу и есть первая веха" },
  { reason: "steam", amount: 30, hint: "Привяжите Steam — лига будет находить ваши матчи" },
  { reason: "telegram", amount: 20, hint: "Привяжите телеграм — оповещения о встречах придут в бота" },
  { reason: "profile", amount: 25, hint: "Заполните анкету целиком: имя, дата рождения, город, контакты" },
];

/** Слепок аккаунта, по которому решается, какие вехи взяты. */
type ShardSubject = {
  status: string;
  steamId: string | null;
  tgId: string | null;
  player:
    | (Parameters<typeof playerGaps>[0] & Parameters<typeof playerAccountId>[0])
    | null;
};

/**
 * Игровая личность аккаунта — тот самый account_id, по которому и считается «второй аккаунт».
 * Сперва подтверждённый Steam-вход (Э15 сделал его основным путём анкеты), затем account_id
 * карточки игрока: он попадает туда из анкеты и проходит через глаза оператора при апруве —
 * а начисляем мы только после апрува.
 */
export function shardIdentity(subject: ShardSubject): string | null {
  const fromSteam = subject.steamId ? accountIdFromSteamId(subject.steamId) : null;
  return fromSteam ?? (subject.player ? playerAccountId(subject.player) : null);
}

/** Взята ли веха. Отдельной функцией, чтобы витрина могла показать невзятые, не переписывая правила. */
export function shardEarned(reason: Exclude<ShardReason, "manual">, subject: ShardSubject): boolean {
  switch (reason) {
    case "welcome":
      return true; // сюда вообще заходят только после апрува — сам факт одобрения и есть веха
    case "steam":
      return !!subject.steamId;
    case "telegram":
      return !!subject.tgId;
    case "profile":
      // «Заполнена» — по тому же списку пробелов, что показывает шапка профиля: два разных
      // определения полноты анкеты на одном экране объяснить нельзя.
      return !!subject.player && playerGaps(subject.player).length === 0;
  }
}

const SUBJECT_SELECT = {
  status: true,
  steamId: true,
  tgId: true,
  player: {
    select: {
      accountId: true,
      dotabuffUrl: true,
      stratzUrl: true,
      steamUrl: true,
      realName: true,
      birthday: true,
      city: true,
      country: true,
      telegram: true,
    },
  },
} as const;

/**
 * Пересмотреть вехи аккаунта и дописать недостающие начисления. Идемпотентна: повторный вызов
 * ничего не удваивает — сталкивается с уникальным `key` и молча пропускает.
 *
 * Зовётся после КАЖДОГО события, которое может закрыть веху: апрув заявки, привязка Steam,
 * привязка телеграма, правка своей анкеты. Дешевле, чем ловить «а что именно изменилось»: одна
 * выборка аккаунта и, как правило, ноль записей.
 */
export async function syncShards(accountId: number): Promise<number> {
  const subject = await prisma.userAccount.findUnique({ where: { id: accountId }, select: SUBJECT_SELECT });
  if (!subject) return 0;
  // Модерация — гейт: до неё вехи не оплачиваются (см. «Анти-абуз» в шапке). Смотрим ровно на
  // колонку, а не на `accountStatus()` с его поправкой «владелец всегда active»: во-первых, эта
  // поправка живёт в `account.ts`, который сам зовёт нас, — вышел бы круг импортов; во-вторых,
  // владельцу, который заявку не подавал, и оплачивать «прошёл модерацию» не за что.
  if (subject.status !== "active") return 0;
  const identity = shardIdentity(subject);
  if (!identity) return 0;

  let added = 0;
  for (const award of SHARD_AWARDS) {
    if (!shardEarned(award.reason, subject)) continue;
    const created = await grantShards(accountId, award.reason, award.amount, `${award.reason}:${identity}`);
    if (created) added += award.amount;
  }
  return added;
}

/**
 * Записать начисление под ключом идемпотентности. Возвращает false, если по этому ключу уже
 * начисляли (в том числе другому аккаунту — так и ловится второй аккаунт с тем же Steam).
 *
 * Гонку двух одновременных вызовов ловит уникальный индекс, а не проверка перед вставкой: два
 * запроса от одного человека (нажал «Привязать» и обновил страницу) идут параллельно, и «сперва
 * посмотреть, потом записать» между ними не спасает.
 */
export async function grantShards(
  accountId: number,
  reason: ShardReason,
  amount: number,
  key: string,
  note?: string | null,
): Promise<boolean> {
  try {
    await prisma.shardEntry.create({ data: { accountId, reason, amount, key, note: note ?? null } });
    return true;
  } catch {
    return false; // ключ занят — веха уже оплачена
  }
}

export type ShardEntryRow = { id: number; reason: string; amount: number; note: string | null; createdAt: Date };

/** Свод для витрины: заработано, ступень, прогресс и сами начисления (за что пришло). */
export type ShardsView = {
  earned: number;
  grade: ShardGrade;
  progress: ReturnType<typeof shardProgress>;
  entries: ShardEntryRow[];
  /** Невзятые вехи — «что сделать, чтобы стало больше». Пусто у чужого профиля: это личный совет. */
  todo: { reason: ShardReason; amount: number; hint: string }[];
};

/** Пустой свод — им отвечают там, где осколков быть не может (гость, игрок без аккаунта). */
export const emptyShards = (): ShardsView => ({
  earned: 0,
  grade: shardGrade(0),
  progress: shardProgress(0),
  entries: [],
  todo: [],
});

async function viewOf(accountId: number, withTodo: boolean): Promise<ShardsView> {
  const entries = await prisma.shardEntry.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    select: { id: true, reason: true, amount: true, note: true, createdAt: true },
  });
  // Заработанное — сумма ПЛЮСОВЫХ строк: когда появятся траты, они не должны ронять грейд.
  const earned = entries.reduce((n, e) => n + Math.max(0, e.amount), 0);
  const paid = new Set(entries.map((e) => e.reason));
  return {
    earned,
    grade: shardGrade(earned),
    progress: shardProgress(earned),
    entries,
    todo: withTodo
      ? SHARD_AWARDS.filter((a) => !paid.has(a.reason)).map((a) => ({ reason: a.reason, amount: a.amount, hint: a.hint }))
      : [],
  };
}

/** Свод по аккаунту — для витрины на главной и в кабинете (свой, поэтому с советами). */
export const shardsOfAccount = (accountId: number) => viewOf(accountId, true);

/**
 * Свод по карточке игрока — для страницы профиля. У карточки может не быть аккаунта вовсе
 * (импортированный ростер): тогда и осколков нет. `own` включает советы «как получить ещё» —
 * на чужой странице им не место.
 */
export async function shardsOfPlayer(playerId: number, own = false): Promise<ShardsView> {
  const account = await prisma.userAccount.findUnique({ where: { playerId }, select: { id: true } });
  return account ? viewOf(account.id, own) : emptyShards();
}
