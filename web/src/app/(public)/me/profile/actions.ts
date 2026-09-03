"use server";

import { revalidatePath } from "next/cache";
import { currentAccount, updateOwnProfile, type OwnProfileInput } from "@/lib/account";
import { anyProfileLinkProblem, profileLinkKind } from "@/lib/application";
import { checkValue, currentValue, submitProfileEdit, type EditField } from "@/lib/profile-edit";

// Правка своей анкеты. Аккаунт берём из сессии, а не из формы — действовать от чужого имени нельзя.
//
// Поля делятся надвое, и правило одно на оба входа — сайт и бот (решение 04.09.2026):
//   · чем человек ПРЕДСТАВЛЕН лиге — ник, город, ссылка на профиль, MMR — уходит заявкой
//     в очередь модерации (`profile-edit.ts`), ту же, куда их шлёт бот;
//   · остальное (имя, страна, дата рождения, телеграм) пишется в профиль сразу (`updateOwnProfile`).
// До этого сайт писал напрямую всё: «ник и ссылку проверяет оператор» было правдой ровно для тех,
// кто пришёл из телеграма.

export type SaveState = { error?: string; ok?: boolean; sent?: string[] } | null;

/** Поле формы → поле очереди. Ссылка одна, а колонок под неё три — какая, решает хост. */
function linkField(raw: string): EditField | null {
  const kind = profileLinkKind(raw);
  return kind === "dotabuff" ? "dotabuffUrl" : kind === "stratz" ? "stratzUrl" : kind === "steam" ? "steamUrl" : null;
}

export async function saveProfile(_state: SaveState, form: FormData): Promise<SaveState> {
  const account = await currentAccount();
  if (!account) return { error: "Сессия истекла — войдите снова" };
  const player = account.player;
  if (!player) return { error: "Профиль не привязан" };

  const text = (key: string) => String(form.get(key) ?? "").trim();

  const input: OwnProfileInput = {
    realName: text("realName"),
    country: text("country"),
    birthday: text("birthday"),
    telegram: text("telegram"),
  };

  const error = await updateOwnProfile(account.id, input);
  if (error) return { error };

  // Заявки — после прямых полей: если очередь что-то отобьёт, анкета уже сохранена, и человеку
  // остаётся поправить одну строку, а не заполнять форму заново.
  const queued: { field: EditField; label: string; raw: string }[] = [];

  const nickname = text("nickname");
  if (!nickname) return { error: "Ник не может быть пустым" };
  queued.push({ field: "nickname", label: "ник", raw: nickname });

  const city = text("city");
  if (city) queued.push({ field: "city", label: "город", raw: city });

  const mmr = text("mmr");
  if (mmr) queued.push({ field: "mmr", label: "MMR", raw: mmr });

  const link = text("profileUrl");
  if (link) {
    const problem = anyProfileLinkProblem(link);
    if (problem) return { error: problem };
    const field = linkField(link);
    if (field) queued.push({ field, label: "ссылка на профиль", raw: link });
  }

  const sent: string[] = [];
  for (const item of queued) {
    // Формат проверяем тем же `checkValue`, что и бот: одно правило на оба входа.
    const checked = checkValue(item.field, item.raw);
    if (!checked.ok) return { error: checked.error };
    // Совпало с тем, что уже в профиле, — заявка не нужна: очередь всё равно отобьёт её как
    // «в профиле уже так и записано», а человек увидел бы ошибку там, где ничего не менял.
    if (checked.value === (currentValue(player, item.field) ?? "")) continue;

    const claim = await submitProfileEdit({ playerId: player.id, field: item.field, value: checked.value });
    // Претензия здесь — почти всегда «правка этого поля уже у организатора»: это не ошибка формы,
    // а состояние, о котором форма и так говорит. Молча пропускаем — остальные поля сохранены.
    if (!claim) sent.push(item.label);
  }

  revalidatePath("/me/profile");
  revalidatePath("/me");
  return { ok: true, sent };
}
