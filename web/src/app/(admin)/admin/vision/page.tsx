import Link from "next/link";
import Image from "next/image";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { VisionMap } from "@/app/_components/postgame/vision-map";
import { listTeamsWithWards, teamVision, mapVision } from "@/lib/vision";
import { denyUnlessPermission } from "../../_components/permission-gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Карта вардов" };

// Операторская: расстановка вардов из архива. Выбираешь команду → её карты и сводное наложение.
// Данные в БД (модель Ward, пишется в syncMatch), поэтому строится офлайн, без похода в OpenDota.

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "—";

const chip = (active: boolean) =>
  `rounded-[14px] px-3.5 py-[9px] text-[13px] font-black transition-[box-shadow,transform,background] ${
    active
      ? "bg-accent-fill text-[var(--on-accent)] cushion-control"
      : "bg-surface text-ink-muted cushion-field hover:text-ink"
  }`;

export default async function VisionPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; map?: string }>;
}) {
  const denied = await denyUnlessPermission("tools", "Карта вардов");
  if (denied) return denied;

  const q = await searchParams;
  const teams = await listTeamsWithWards();
  const vision = q.team ? await teamVision(q.team) : null;
  const map = vision && q.map ? await mapVision(Number(q.map)) : null;

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 font-pouf md:px-6`}>
      <h1 className="text-[28px] font-black tracking-[-0.5px] text-ink md:text-4xl">Карта вардов</h1>
      <p className="mt-1 text-sm font-bold text-muted">
        Расстановка вардов команды по всем её картам из архива. Выбери команду — увидишь сводное наложение и каждую карту отдельно.
      </p>

      {teams.length === 0 ? (
        <div className="mt-6 rounded-card bg-surface p-6 text-sm font-bold text-muted cushion-card">
          Вардов в архиве пока нет. Они появляются, когда карта привязана и перечитана из OpenDota (распарсенный матч).
          Для уже привязанных карт запусти перечитку: <code className="text-ink">npx tsx scripts/backfill-wards.ts</code>.
        </div>
      ) : (
        <>
          {/* Выбор команды */}
          <div className="mt-6 flex flex-wrap gap-2">
            {teams.map((t) => (
              <Link key={t.slug} href={`/admin/vision?team=${t.slug}`} className={chip(t.slug === q.team)}>
                <span className="flex items-center gap-2">
                  {t.logo && <Image src={t.logo} alt="" width={20} height={20} className="h-5 w-5 rounded object-contain" />}
                  {t.name}
                  <span className="tabular-nums text-ink-subtle">· {t.maps}</span>
                </span>
              </Link>
            ))}
          </div>

          {vision && (
            <>
              {/* Сводно / выбор карты */}
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <Link href={`/admin/vision?team=${vision.team.slug}`} className={chip(!q.map)}>
                  Сводно · {vision.maps.length} карт
                </Link>
                <span className="mx-1 h-5 w-px bg-hairline" />
                {vision.maps.map((m) => (
                  <Link
                    key={m.matchId}
                    href={`/admin/vision?team=${vision.team.slug}&map=${m.matchId}`}
                    className={chip(String(m.matchId) === q.map)}
                    title={`${m.obs} обс · ${m.sen} сентри${m.side ? ` · ${m.side === "radiant" ? "свет" : "тьма"}` : ""}`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${
                          m.won == null ? "bg-neutral-500" : m.won ? "bg-emerald-400" : "bg-rose-400"
                        }`}
                      />
                      vs {m.opponent}
                      <span className="text-ink-subtle">{fmtDate(m.date)}</span>
                    </span>
                  </Link>
                ))}
              </div>

              <div className="mt-4">
                {map ? (
                  <VisionMap
                    wards={map.wards}
                    durationSeconds={map.durationSeconds}
                    sideLabels={{ radiant: map.radiantName, dire: map.direName }}
                  />
                ) : (
                  <VisionMap
                    wards={vision.wards}
                    timeline={false}
                    sideLabels={{ radiant: "за свет", dire: "за тьму" }}
                  />
                )}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
