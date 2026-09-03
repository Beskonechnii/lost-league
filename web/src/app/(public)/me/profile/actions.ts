"use server";

import { revalidatePath } from "next/cache";
import { currentAccount } from "@/lib/account";
import { updateOwnProfile, type OwnProfileInput } from "@/lib/account";
import { checkValue, submitProfileEdit } from "@/lib/profile-edit";

// Правка своей анкеты. Аккаунт берём из сессии, а не из формы — действовать от чужого имени нельзя.
// Список полей — ровно тот, что игроку разрешён (updateOwnProfile его же и стережёт).
//
// MMR идёт мимо этого списка: он не пишется в профиль, а встаёт ЗАЯВКОЙ в очередь модерации
// (та же очередь «Правки профиля», куда их шлёт бот, — src/lib/profile-edit.ts). Причина в
// DECISIONS 04.09.2026: перед новым турниром за MMR приходят чаще всего, но число со слов игрока
// лига проверяет глазами.

export type SaveState = { error?: string; ok?: boolean; mmrSent?: boolean } | null;

export async function saveProfile(_state: SaveState, form: FormData): Promise<SaveState> {
  const account = await currentAccount();
  if (!account) return { error: "Сессия истекла — войдите снова" };
  if (!account.player) return { error: "Профиль не привязан" };

  const input: OwnProfileInput = {
    nickname: String(form.get("nickname") ?? ""),
    realName: String(form.get("realName") ?? ""),
    city: String(form.get("city") ?? ""),
    country: String(form.get("country") ?? ""),
    birthday: String(form.get("birthday") ?? ""),
    telegram: String(form.get("telegram") ?? ""),
    profileUrl: String(form.get("profileUrl") ?? ""),
  };

  const error = await updateOwnProfile(account.id, input);
  if (error) return { error };

  // MMR — после остальных полей: если заявка не примется, анкета всё равно уже сохранена, и
  // человеку остаётся поправить одно число, а не заполнять форму заново.
  const mmr = String(form.get("mmr") ?? "").trim();
  let mmrSent = false;
  if (mmr) {
    // Формат проверяем тем же `checkValue`, что и бот: одно правило на оба входа.
    const checked = checkValue("mmr", mmr);
    if (!checked.ok) return { error: checked.error };
    if (checked.value !== String(account.player.mmr ?? "")) {
      const claim = await submitProfileEdit({ playerId: account.player.id, field: "mmr", value: checked.value });
      if (claim) return { error: claim };
      mmrSent = true;
    }
  }

  revalidatePath("/me/profile");
  revalidatePath("/me");
  return { ok: true, mmrSent };
}
