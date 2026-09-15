import Link from "next/link";
import { buttonClasses } from "@/components/pouf/Button";
import { SectionHeader } from "@/components/pouf/blocks";
import { EmptyState, StatusPill } from "@/components/pouf/feedback";
import { canCreateLobby, currentViewer, listLobbies } from "@/lib/lobby";
import { PHASE } from "./_components/phase";

export const dynamic = "force-dynamic";

// Мои комнаты встреч. Чужих в списке нет: лобби закрытое, и «существует комната, куда вас не
// звали» — это ровно то, чего решение 9 показывать не велит. Админу с `tools` видны все: он
// администратор комнаты и входит в любую.

export default async function LobbyIndexPage() {
  const viewer = await currentViewer();
  if (!viewer) return <Gate />;

  const [rows, mayCreate] = await Promise.all([listLobbies(viewer), canCreateLobby()]);

  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader
        eyebrow="Лига · комната встречи"
        title="Лобби"
        aside={
          mayCreate ? (
            <Link href="/lobby/new" className={`inline-flex ${buttonClasses({ size: "sm" })}`}>
              Собрать лобби
            </Link>
          ) : (
            <>Комнату заводят игроки лиги</>
          )
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon="sword" title="Комнат пока нет">
          Лобби собирает капитан или организатор: две команды, тайминги и список приглашённых.
          Приглашение приходит сообщением от Spirit CTRL.
        </EmptyState>
      ) : (
        <div className="max-w-2xl space-y-2">
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/lobby/${r.id}`}
              className="flex items-center gap-3 rounded-card bg-surface px-4 py-3 cushion-row hover:cushion-row-hover"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-ink">{r.title}</span>
                <span className="block truncate text-[11px] font-bold text-muted">{r.sides}</span>
              </span>
              <StatusPill tone={PHASE[r.status].tone}>{PHASE[r.status].label}</StatusPill>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Не вошёл — комнат у него нет по определению. Дверь одна, как и у чата. */
function Gate() {
  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader eyebrow="Лига · комната встречи" title="Лобби" />
      <div className="rounded-control bg-surface p-6 cushion-row">
        <p className="max-w-prose text-sm font-bold text-muted">
          Комнаты встреч открыты участникам лиги: нужно войти и получить одобрение заявки. Без
          приглашения комната не видна — по прямой ссылке её тоже не открыть.
        </p>
        <Link href="/me" className={`mt-4 inline-flex ${buttonClasses()}`}>
          В кабинет
        </Link>
      </div>
    </div>
  );
}
