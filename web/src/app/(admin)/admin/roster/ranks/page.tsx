import Link from "next/link";
import { READ_MAX_W } from "@/components/pouf/blocks";
import { DataCell, DataRow, DataTable } from "@/components/pouf/data-table";
import { EmptyState } from "@/components/pouf/feedback";
import { RankBadge, RankTrend } from "@/components/pouf/rank";
import { rankLabel } from "@/lib/dota-rank";
import { playerPath } from "@/lib/profiles";
import { playersWithoutAccountId, playersWithRankChange } from "@/lib/rank-refresh";
import { AdminHeader } from "../../../_components/admin-header";
import { denyUnlessPermission } from "../../../_components/permission-gate";
import { RefreshPanel } from "./refresh-panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ранги" };

// Ранги лиги (RELEASE-PLAN §E, Э20). Отдельный экран, а не кнопка в импорте составов: импорт пишет
// составы и запускается раз в сезон, а ранг сверяют регулярно и ничего при этом менять не хотят.
//
// Витрина отвечает на один вопрос — «у кого что изменилось», — поэтому список отсортирован по
// времени сверки, а не по величине ранга: рейтинг игроков по медалям здесь никому не нужен, он
// живёт в ростере.

/** «сегодня» / «вчера» / дата — оператор смотрит на свежесть, а не на календарь. */
function seenAt(at: Date | null): string {
  if (!at) return "не сверяли";
  const days = Math.floor((Date.now() - at.getTime()) / 86_400_000);
  if (days <= 0) return "сегодня";
  if (days === 1) return "вчера";
  if (days < 7) return `${days} дн. назад`;
  return at.toLocaleDateString("ru");
}

export default async function RanksPage() {
  const denied = await denyUnlessPermission("roster.edit", "Ранги");
  if (denied) return denied;

  const [players, withoutId] = await Promise.all([playersWithRankChange(), playersWithoutAccountId()]);
  const moved = players.filter((p) => p.delta).length;

  return (
    <main className={`mx-auto w-full ${READ_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <AdminHeader
        title="Ранги"
        aside={
          <>
            {players.length} с рангом
            {moved > 0 && <span className="ml-2 text-[var(--accent-ink)]">{moved} с изменением</span>}
          </>
        }
      >
        Ранг приезжает из OpenDota по account_id игрока — тем же путём, что при импорте составов, но
        сам по себе и по всей лиге сразу. Прошлое значение сохраняется, поэтому рядом с медалью видно,
        куда человек уехал с прошлой сверки. Обновление идёт примерно по игроку в секунду: столько
        разрешает бесплатный OpenDota, и ускорить это нечем.
      </AdminHeader>

      <div className="mt-6">
        <RefreshPanel withoutId={withoutId} />
      </div>

      <div className="mt-8">
        <DataTable
          caption="Ранги игроков"
          columns={[
            { label: "Игрок" },
            { label: "Ранг" },
            { label: "Было", hideOnNarrow: true },
            { label: "Изменение", align: "right" },
            { label: "Сверен", align: "right", hideOnNarrow: true },
          ]}
          empty={
            players.length === 0 ? (
              <EmptyState title="Рангов пока нет">
                Ни у одного игрока не записан ранг. Нажмите «Обновить ранги» — тем, у кого есть
                account_id, он подтянется из OpenDota.
              </EmptyState>
            ) : undefined
          }
        >
          {players.map((p) => (
            <DataRow key={p.id}>
              <DataCell>
                <Link href={playerPath(p)} className="font-black text-ink hover:text-[var(--accent-ink)]">
                  {p.nickname}
                </Link>
              </DataCell>
              <DataCell nowrap>
                <RankBadge tier={p.rank} size="sm" />
              </DataCell>
              <DataCell muted hideOnNarrow nowrap>
                {rankLabel(p.rankPrev) ?? "—"}
              </DataCell>
              <DataCell align="right" nowrap>
                <RankTrend tier={p.rank} prev={p.rankPrev} />
              </DataCell>
              <DataCell align="right" muted hideOnNarrow nowrap>
                {seenAt(p.rankAt)}
              </DataCell>
            </DataRow>
          ))}
        </DataTable>
      </div>
    </main>
  );
}
