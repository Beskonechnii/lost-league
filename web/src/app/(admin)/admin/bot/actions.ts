"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { BOT_SETTINGS, isBotSettingKey, normalizeSetting } from "@/lib/bot-settings";

// Правка настроек телеграм-бота. Право проверяется здесь, у самой записи: страницу можно и не
// открывать, а отрисована она могла быть со старыми правами (docs/archive/ACCOUNTS-PLAN.md §2.2).
// Отдельного права у бота нет — это то же `tournaments.edit`.
//
// В таблицу пишем только отличия от дефолта (`bot-settings.ts`): значение, равное исходному, стирает
// строку, а не хранит копию. Иначе «вернуть исходное» пришлось бы отличать от «оператор выставил
// ровно то же самое», и правка дефолта в коде не доезжала бы до тех, кто ничего не менял.
//
// Тексты шагов диалога сюда не входят с Э6: формулировка — свойство ноды в `/admin/bot/flow`.

const PATH = "/admin/bot";

export type BotState = { error?: string; ok?: string } | null;


/**
 * Настройка флоу: тайминги и тексты уведомлений. Значение проходит через `normalizeSetting` —
 * в базу не должно попасть «25:00», которое потом молча сломает рассылку.
 */
export async function saveSetting(_prev: BotState, form: FormData): Promise<BotState> {
  try {
    await requirePermission("tournaments.edit");
    const key = String(form.get("key") ?? "");
    if (!isBotSettingKey(key)) return { error: "Неизвестная настройка" };
    const field = BOT_SETTINGS.find((f) => f.key === key)!;

    const checked = normalizeSetting(key, String(form.get("value") ?? ""));
    if ("error" in checked) return { error: checked.error };

    // Совпало с дефолтом — строку не храним: иначе правка дефолта в коде не доедет до тех,
    // кто ничего не менял.
    if (checked.value === field.value) await prisma.botSetting.deleteMany({ where: { key } });
    else await prisma.botSetting.upsert({ where: { key }, create: { key, value: checked.value }, update: { value: checked.value } });

    revalidatePath(PATH);
    return { ok: `Сохранено: ${field.label}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось сохранить настройку" };
  }
}

/** Вернуть настройке значение из кода. */
export async function resetSetting(form: FormData): Promise<void> {
  await requirePermission("tournaments.edit");
  const key = String(form.get("key") ?? "");
  if (!isBotSettingKey(key)) return;
  await prisma.botSetting.deleteMany({ where: { key } });
  revalidatePath(PATH);
}

