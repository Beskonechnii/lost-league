import type { PermissionKey } from "@/lib/permissions";
import { moderationQueues } from "@/lib/moderation";
import { duplicatesCount } from "@/lib/duplicates";
import { DUPLICATES_TOOL, QUEUE_TOOL } from "@/app/_components/tools";
import { withPlural } from "@/lib/plural";

/**
 * Очереди служебной части — одним вызовом на оба уровня навигации: карточку группы на `/admin`
 * и плитку инструмента на странице группы. Значение одно, считается один раз; разойтись двум
 * числам не на чем.
 *
 * Числа берутся теми же вызовами, что и сами разделы: счётчик — обещание, и он обязан совпасть
 * со списком, который человек там увидит.
 *
 * `counts` — для бейджа плитки (там число однозначно: три чего — написано на самой плитке).
 * `words` — для карточки группы, где «3» на девяти инструментах не говорит ничего.
 */
export async function queueBadges(perms: PermissionKey[]) {
  const mayEdit = perms.includes("roster.edit");
  const pending = perms.includes("accounts.approve") ? (await moderationQueues(mayEdit)).total : 0;
  const duplicates = mayEdit ? await duplicatesCount() : 0;

  const counts: Record<string, number> = { [QUEUE_TOOL]: pending, [DUPLICATES_TOOL]: duplicates };
  const words: Record<string, string> = {};
  // Ноль не рисуется: индикатор, который всегда на месте, перестаёт быть сигналом.
  if (pending) words[QUEUE_TOOL] = withPlural(pending, "анкета", "анкеты", "анкет");
  if (duplicates) words[DUPLICATES_TOOL] = withPlural(duplicates, "дубль", "дубля", "дублей");

  return { counts, words };
}
