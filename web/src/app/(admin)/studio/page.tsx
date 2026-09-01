import Link from "next/link";
import { TEMPLATES } from "@/studio/registry";
import { prisma } from "@/lib/prisma";
import { Eyebrow } from "@/components/pouf/text";
import { RenderHistory } from "./_components/render-history";

export const dynamic = "force-dynamic";

export default async function StudioHome() {
  const [teams, players, renders] = await Promise.all([
    prisma.team.count(),
    prisma.player.count(),
    prisma.render.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  return (
    <div className="space-y-10 font-pouf">
      <div>
        <Eyebrow className="mb-2">Служебная часть · графика</Eyebrow>
        <h1 className="text-[28px] font-black tracking-[-0.5px] text-ink md:text-4xl">Студия</h1>
        <p className="mt-1.5 text-sm font-bold text-muted">
          Графика собирается по данным ростера: {teams} команд(ы) и {players} игрок(ов). Лого, фото и составы правятся в{" "}
          <Link href="/roster" className="text-[var(--accent-ink)] hover:underline">
            разделе «Ростер»
          </Link>
          .
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {TEMPLATES.map((t) => (
          <Link
            key={t.id}
            href={`/studio/new/${t.id}`}
            className="rounded-card bg-surface p-5 cushion-card transition-transform duration-200 hover:-translate-y-1"
          >
            <div className="text-lg font-black text-ink">{t.title}</div>
            <div className="mt-1 text-sm font-bold text-muted">{t.description}</div>
            <div className="mt-3 text-[10px] font-extrabold uppercase tracking-[1px] text-ink-subtle">
              {t.size.w}×{t.size.h}
            </div>
          </Link>
        ))}
      </div>

      <RenderHistory
        renders={renders.map((r) => ({
          id: r.id,
          templateId: r.templateId,
          title: r.title,
          created: r.createdAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }),
        }))}
      />
    </div>
  );
}
