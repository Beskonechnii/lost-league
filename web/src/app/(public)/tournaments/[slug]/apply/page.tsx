import Link from "next/link";
import { notFound } from "next/navigation";
import { registrationOpen, tournamentBySlug } from "@/lib/tournaments";
import { currentAccount } from "@/lib/account";
import { myApplications, parseDraft } from "@/lib/team-application";
import { prisma } from "@/lib/prisma";
import { roleLabel } from "@/lib/roles";
import { ApplyForm } from "./apply-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Заявка команды" };

// Заявка капитана на турнир. Попадает в ту же очередь `TeamApplication`, что и импорт файла, —
// разница только в `source`. Приём открыт, пока турнир в статусе «Приём заявок».

const date = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long" });

export default async function ApplyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tournament = await tournamentBySlug(slug);
  if (!tournament || tournament.status === "draft") notFound();

  const me = await currentAccount();
  const mine = me ? await myApplications(me.id, tournament.id) : [];
  const open = registrationOpen(tournament);

  // Ники ростера — подсказки в поле состава: «этот игрок в лиге уже есть, вот его ник как в базе».
  const known = me ? await prisma.player.findMany({ select: { nickname: true }, orderBy: { nickname: "asc" } }) : [];

  // Открытая заявка (ждёт решения или возвращена) открывается на правку, а не заводит вторую
  // строку в очереди: повторная подача — это досыл правок, а не новая команда.
  const editable = mine.find((a) => a.status === "pending" || a.status === "rejected") ?? null;
  const editableDraft = editable ? parseDraft(editable.payload) : null;
  const initial = editableDraft
    ? {
        name: editableDraft.name,
        tag: editableDraft.tag,
        divisionId: editable!.divisionId,
        players: editableDraft.players.map((p) => ({
          nickname: p.nickname,
          realName: p.realName ?? null,
          role: p.role ?? null,
          mmr: p.mmr ?? null,
          link: p.dotabuffUrl ?? p.stratzUrl ?? p.steamUrl ?? null,
          telegram: p.telegram ?? null,
          isCaptain: p.isCaptain ?? false,
        })),
      }
    : null;

  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight">Заявка команды</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        {tournament.name}
        {tournament.regCloseAt && ` · заявки до ${date.format(tournament.regCloseAt)}`}
      </p>

      {mine.length > 0 && (
        <ul className="mt-6 space-y-2">
          {mine.map((a) => {
            const draft = parseDraft(a.payload);
            return (
              <li key={a.id} className="rounded-lg border border-hairline bg-surface-1 p-4 text-sm">
                <p>
                  <span className="font-semibold">{draft?.name ?? "заявка"}</span>{" "}
                  <span className="text-ink-subtle">
                    ·{" "}
                    {a.status === "pending" ? "на рассмотрении"
                      : a.status === "approved" ? "принята"
                      : "возвращена"}
                    {a.division && ` · ${a.division.name}`}
                  </span>
                </p>
                {draft && (
                  <p className="mt-1 text-xs text-ink-subtle">
                    {draft.players.map((p) => `${p.nickname} (${roleLabel(p.role) ?? "роль не указана"})`).join(", ")}
                  </p>
                )}
                {a.notes && <p className="mt-1 text-xs text-amber-300">Причина возврата: {a.notes}</p>}
              </li>
            );
          })}
        </ul>
      )}

      {!me ? (
        <p className="mt-6 rounded-md border border-hairline bg-surface-1 px-3 py-4 text-sm text-ink-muted">
          Заявку подаёт капитан из своего аккаунта.{" "}
          <Link href="/me" className="text-accent-bright hover:underline">Войти в кабинет</Link>
        </p>
      ) : !open ? (
        <p className="mt-6 rounded-md border border-hairline bg-surface-1 px-3 py-4 text-sm text-ink-muted">
          Приём заявок на этот турнир сейчас закрыт.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {/* Свой статус в лиге подаче не мешает (решение 23.08.2026): капитан новой команды часто
              сам ещё не в ростере, а заявка всё равно проходит модерацию. */}
          {me.status !== "active" && (
            <p className="rounded-md border border-hairline bg-surface-1 px-3 py-2 text-xs text-ink-muted">
              Ваша личная анкета ещё на модерации — на заявку команды это не влияет, её рассмотрят
              отдельно.
            </p>
          )}
          {editable && (
            <p className="rounded-md border border-sky-900 bg-sky-950/40 px-3 py-2 text-xs text-sky-300">
              {editable.status === "rejected"
                ? "Заявка возвращена — поправьте состав и отправьте снова, новая строка в очереди не появится."
                : "Заявка уже подана и ждёт решения. Правки сохранятся в неё же."}
            </p>
          )}
          <ApplyForm
            tournamentId={tournament.id}
            tournamentSlug={tournament.slug}
            divisions={tournament.divisions.map((d) => ({ id: d.id, name: d.name }))}
            knownNicknames={known.map((p) => p.nickname)}
            initial={initial}
          />
        </div>
      )}
    </div>
  );
}
