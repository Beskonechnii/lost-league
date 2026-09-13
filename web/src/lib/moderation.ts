// Очередь модерации: четыре источника, которые разбирают на /admin/moderation — анкеты новых
// игроков, привязки к профилю, заявки команд и правки профиля.
//
// Собрано в одном месте ради числа на бейдже. До этого формула жила дважды: страница считала по
// четырём вкладкам, а плитка хаба — по двум, и на непустой очереди человек видел на хабе «3»,
// заходил и находил пять заявок. Число у входа обязано совпадать со списком за ним, поэтому
// считает их один вызов, а не два похожих.

import { pendingClaims, pendingRegistrations } from "./account";
import { pendingProfileEdits, type PendingProfileEdit } from "./profile-edit";
import { pendingApplications } from "./team-application";

/** Всё, что ждёт решения, разом. `mayEdit` — право `roster.edit`: без него вкладки «Правки
 *  профиля» на экране нет вовсе, и в сумму её считать нечего. */
export async function moderationQueues(mayEdit: boolean) {
  const [profiles, links, teams, edits] = await Promise.all([
    pendingRegistrations(),
    pendingClaims(),
    pendingApplications(),
    mayEdit ? pendingProfileEdits() : Promise.resolve([] as PendingProfileEdit[]),
  ]);

  return {
    profiles,
    links,
    teams,
    edits,
    total: profiles.length + links.length + teams.length + edits.length,
  };
}
