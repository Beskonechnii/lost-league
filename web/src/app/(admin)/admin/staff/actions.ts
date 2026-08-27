"use server";

import { revalidatePath } from "next/cache";
import { deleteAccount, setAccountPermissions, setAccountRole } from "@/lib/account";

// Экшены панели команды лиги. Право accounts.admins и запрет трогать себя/владельца проверяются
// внутри setAccountRole/setAccountPermissions — там, где идёт запись: до экшена можно дойти и мимо
// страницы, а страница уже могла быть отрисована со старыми правами.

export async function makeAdmin(form: FormData): Promise<void> {
  await setAccountRole(Number(form.get("accountId")), "admin");
  revalidatePath("/admin/staff");
}

export async function removeAdmin(form: FormData): Promise<void> {
  await setAccountRole(Number(form.get("accountId")), "player");
  revalidatePath("/admin/staff");
}

export async function savePermissions(form: FormData): Promise<void> {
  // Чекбоксы: браузер шлёт только отмеченные, снятые просто не приходят — значит набор целиком.
  const keys = form.getAll("perm").map(String);
  await setAccountPermissions(Number(form.get("accountId")), keys);
  revalidatePath("/admin/staff");
}

export async function removeAccount(form: FormData): Promise<void> {
  await deleteAccount(Number(form.get("accountId")));
  revalidatePath("/admin/staff");
}
