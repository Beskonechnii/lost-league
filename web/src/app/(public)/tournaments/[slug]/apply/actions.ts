"use server";

import { revalidatePath } from "next/cache";
import { currentAccount } from "@/lib/account";
import { applicationProblems, submitTeamApplication, type Problem } from "@/lib/team-application";
import { notifyRosterInvites } from "@/lib/tg-notify";
import { splitTeamName, type PlayerDraft, type TeamDraft } from "@/lib/roster-import";
import { prisma } from "@/lib/prisma";
import { isRole } from "@/lib/roles";
import { slugify, playerAccountId } from "@/lib/profiles";
import type { RosterInput } from "./slots";

// Приём заявки капитана. Состав приходит слотами (`RosterInput`): id игроков пула плюс роль слота —
// имена, ссылки и MMR берём из базы, а не из формы. Отсюда же и главное правило Э5: в составе может
// быть только человек, которого лига знает; чужой id просто не найдётся, и заявка не уйдёт.
//
// Дальше заявка живёт по общим правилам: очередь, замечания, апрув (src/lib/team-application.ts).

export type ApplyState = {
  error?: string;
  ok?: string;
  problems?: Problem[];
} | null;

/** Состав из id пула → черновик заявки. Бросает, если id нет в базе: пул — единственный источник. */
async function buildDraft(input: RosterInput): Promise<TeamDraft> {
  const { name, tag } = splitTeamName(input.name);
  const ids = input.players.map((p) => p.playerId);
  const found = await prisma.player.findMany({ where: { id: { in: ids } } });
  const byId = new Map(found.map((p) => [p.id, p]));

  const players: PlayerDraft[] = input.players.map((row) => {
    const p = byId.get(row.playerId);
    if (!p) throw new Error("Кого-то из состава больше нет в базе лиги — обновите страницу");
    return {
      nickname: p.nickname,
      realName: p.realName,
      role: isRole(row.role) ? row.role : null,
      mmr: p.mmr,
      accountId: playerAccountId(p),
      dotabuffUrl: p.dotabuffUrl,
      stratzUrl: p.stratzUrl,
      steamUrl: p.steamUrl,
      telegram: p.telegram,
      isCaptain: row.isCaptain,
      rank: p.rank,
    };
  });

  return { slug: slugify(name), name, tag: input.tag.trim() || tag, players };
}

export async function submitApplication(_prev: ApplyState, form: FormData): Promise<ApplyState> {
  const me = await currentAccount();
  // Подать может любой вошедший аккаунт, даже в статусе `draft` (решение Стаса, 23.08.2026):
  // капитан новой команды часто сам ещё не в лиге, а заявка всё равно проходит модерацию —
  // второй фильтр на входе только мешал бы.
  if (!me) return { error: "Заявку подаёт вошедший капитан — войдите в кабинет" };

  let input: RosterInput;
  try {
    input = JSON.parse(String(form.get("roster") ?? "")) as RosterInput;
  } catch {
    return { error: "Не разобрал состав — обновите страницу и соберите заново" };
  }
  if (!input?.name?.trim()) return { error: "Укажите название команды" };

  let draft: TeamDraft;
  try {
    draft = await buildDraft(input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось собрать состав" };
  }

  const problems = await applicationProblems(draft, input.divisionId);

  // «Проверить состав» — тот же разбор, но без записи: капитан видит замечания до отправки, а не
  // узнаёт о них от модератора через день.
  const blocking = problems.filter((p) => p.level === "block");
  if (String(form.get("intent") ?? "") === "check") {
    return {
      problems,
      ok: blocking.length === 0 ? "Замечаний, мешающих отправке, нет" : undefined,
      error: blocking.length ? "Это надо поправить до отправки" : undefined,
    };
  }
  // Красное замечание — ошибка составителя (игрок уже действующий в другой команде дивизиона):
  // отправлять такую заявку модератору незачем, она вернётся с той же причиной.
  if (blocking.length)
    return { problems, error: "Заявку нельзя отправить, пока есть красные замечания" };

  try {
    const { invited } = await submitTeamApplication(
      me.id,
      Number(form.get("tournamentId")),
      input.divisionId,
      draft,
    );
    // Уведомление — после записи и своим шагом: телеграм может лежать, но заявка уже принята,
    // и ронять из-за него отправку нельзя (тот же уговор, что у решений оператора в tg-notify).
    await notifyRosterInvites(invited, draft.name);
    revalidatePath(`/tournaments/${String(form.get("tournamentSlug") ?? "")}/apply`);
    return {
      problems,
      ok:
        invited.length > 0
          ? `Заявка отправлена — она появится в очереди организаторов. Позвали в состав: ${invited.length}.`
          : "Заявка отправлена — она появится в очереди организаторов",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось отправить заявку" };
  }
}
