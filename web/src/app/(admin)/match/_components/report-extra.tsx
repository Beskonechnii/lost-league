"use client";

import { HeroFrame, Icon } from "@/app/_components/postgame/blocks";
import { clock, type PickBan, type PlayerReport, type TalentOpt, type TalentTier } from "@/app/_components/postgame/types";

/* Вкладка «Доп. статистика»: порядок пиков и банов, полное дерево талантов,
 * порядок способностей и тайминги покупок. Выделена из `report.tsx` на Э6 —
 * это отдельный экран, а не часть отчёта, и на главной вкладке он не рисуется. */

/** Порядок драфта: две колонки по сторонам, каждая строка — номер, иконка, имя. */
export function Draft({ picksBans, names }: { picksBans: PickBan[]; names: { radiant: string; dire: string } }) {
  if (picksBans.length === 0) return null;
  const Row = ({ pb }: { pb: PickBan }) => (
    <div
      className={`flex items-center gap-1.5 rounded-chip px-1.5 py-1 text-[11px] font-bold ${
        pb.isPick ? "bg-surface-2 cushion-field" : "opacity-70"
      }`}
      style={{ color: pb.side === "radiant" ? "var(--pg-radiant)" : "var(--pg-dire)" }}
    >
      <span className="w-4 shrink-0 text-right tabular-nums text-muted">{pb.order + 1}.</span>
      <HeroFrame hero={pb.hero} side={pb.side} h={18} banned={!pb.isPick} />
      <span className="truncate">
        {pb.isPick ? "" : "бан "}
        {pb.hero.name}
      </span>
    </div>
  );
  return (
    <div>
      <div className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-muted">Пики и баны (по очереди)</div>
      <div className="grid grid-cols-2 gap-4">
        {(["radiant", "dire"] as const).map((side) => (
          <div key={side}>
            <div
              className="mb-2 truncate text-[11px] font-black uppercase tracking-wide"
              style={{ color: side === "radiant" ? "var(--pg-radiant)" : "var(--pg-dire)" }}
            >
              {(side === "radiant" ? names.radiant : names.dire) || (side === "radiant" ? "Свет" : "Тьма")}
            </div>
            <div className="flex flex-col gap-1">
              {picksBans
                .filter((pb) => pb.side === side)
                .map((pb) => (
                  <Row key={pb.order} pb={pb} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Полное дерево талантов: ярусы 25→10, слева/справа стороны, в центре кружок уровня.
 * Выбранная сторона подсвечена мятным — акцентом Кита; в тёмной теме тут было золото.
 */
function TalentTree({ talents }: { talents: TalentTier[] }) {
  if (talents.length === 0) return null;
  const Side = ({ opt, align }: { opt: TalentOpt | null; align: "left" | "right" }) => (
    <div
      title={opt?.name}
      className={`flex-1 self-stretch px-2 py-1 text-[11px] font-bold leading-tight ${align === "right" ? "text-right" : "text-left"} ${
        opt?.picked ? "bg-accent-fill font-black text-[var(--on-accent)]" : "text-muted"
      }`}
    >
      {opt?.name ?? ""}
    </div>
  );
  return (
    <div className="mb-2">
      <div className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-muted">Таланты</div>
      <div className="flex flex-col gap-1.5">
        {talents.map((t) => (
          <div key={t.heroLevel} className="flex items-center overflow-hidden rounded-chip bg-surface-2 cushion-field">
            <Side opt={t.left} align="right" />
            <div className="grid h-6 w-6 flex-none place-items-center rounded-pill bg-surface text-[11px] font-black tabular-nums text-ink cushion-row">
              {t.heroLevel}
            </div>
            <Side opt={t.right} align="left" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Один игрок в разрезе «что качал и что покупал». */
export function PlayerDetails({ p }: { p: PlayerReport }) {
  return (
    <div className="rounded-blob bg-surface p-3 text-xs cushion-row">
      <div className="mb-2 flex items-center gap-2">
        <Icon kind="heroes" slug={p.hero.slug} name={p.hero.name} h={22} />
        <span className="font-black text-ink">{p.name}</span>
        <span className="font-bold text-muted">
          {p.role} · {p.hero.name}
        </span>
      </div>
      {p.buffs.length > 0 && (
        <div className="mb-2 font-bold text-muted">
          Баффы: {p.buffs.map((b) => `${b.name}${b.stacks ? ` ×${b.stacks}` : ""}`).join(", ")}
        </div>
      )}
      <TalentTree talents={p.talents} />
      {p.abilityOrder.length > 0 && (
        <div className="mb-2">
          <div className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-muted">Порядок способностей</div>
          <ol className="flex flex-wrap gap-1">
            {p.abilityOrder.map((a, i) => (
              <li key={i} className="flex items-center gap-1 rounded-chip bg-surface-2 px-1 py-0.5 cushion-field">
                <span className="text-[10px] font-bold text-muted">{i + 1}</span>
                <Icon kind="abilities" slug={a.slug} name={a.name} h={18} />
              </li>
            ))}
          </ol>
        </div>
      )}
      {p.purchases.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-muted">Покупки (время)</div>
          <div className="flex flex-wrap gap-x-2 gap-y-1">
            {p.purchases.map((q, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <Icon kind="items" slug={q.slug} name={q.name} h={18} />
                <span className="font-bold text-muted">{clock(q.time)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
