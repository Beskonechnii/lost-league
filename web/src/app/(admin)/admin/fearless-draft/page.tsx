import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Eyebrow, SITE_MAX_W } from "@/app/_components/ui";
import { NewFearlessButton } from "./_components/new-fearless-button";
import { denyUnlessPermission } from "../../_components/permission-gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fearless draft" };

// Архив fearless-серий: список сессий + кнопка новой. Сам борд — на /admin/fearless-draft/[id].
// Как UNDERBEER: сессия эфемерная, состояние в payload (не в снимке БД).

export default async function FearlessHome() {
  const denied = await denyUnlessPermission("tools", "Fearless draft");
  if (denied) return denied;

  const sessions = await prisma.fearlessSession.findMany({ orderBy: { updatedAt: "desc" }, take: 50 });

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 font-pouf md:px-6`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow className="mb-2">Служебная часть · fearless</Eyebrow>
          <h1 className="text-[28px] font-black tracking-[-0.5px] text-ink md:text-4xl">Fearless draft</h1>
          <p className="mt-1.5 max-w-2xl text-sm font-bold text-muted">
            Драфт героев без повторов по серии: рандом-пул 9/атрибут, монетка, баны и пики с таймерами.
          </p>
        </div>
        <NewFearlessButton />
      </div>

      <div className="mt-8 space-y-2">
        {sessions.length === 0 && <p className="text-sm font-bold text-muted">Пока нет сохранённых драфтов. Создай новый.</p>}
        {sessions.map((s) => (
          <Link
            key={s.id}
            href={`/admin/fearless-draft/${s.id}`}
            className="flex items-center justify-between gap-3 rounded-card bg-surface p-4 cushion-row transition-transform hover:-translate-y-px hover:cushion-row-hover"
          >
            <div className="min-w-0">
              <div className="truncate font-black text-ink">{s.title || `Драфт #${s.id}`}</div>
              <div className="text-xs font-bold text-muted">
                обновлён {s.updatedAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
              </div>
            </div>
            <span className={`shrink-0 rounded-pill px-2.5 py-0.5 text-xs font-black ${s.status === "done" ? "bg-mint text-[var(--on-accent)]" : "bg-surface-2 text-ink-muted"}`}>
              {s.status === "done" ? "готов" : "черновик"}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
