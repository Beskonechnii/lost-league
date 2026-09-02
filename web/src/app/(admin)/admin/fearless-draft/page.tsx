import { prisma } from "@/lib/prisma";
import { AdminHeader } from "../../_components/admin-header";
import { SessionList } from "../../_components/session-list";
import { NewFearlessButton } from "./_components/new-fearless-button";

export const dynamic = "force-dynamic";

// Архив fearless-серий: список сессий + кнопка новой. Сам борд — на /admin/fearless-draft/[id].
// Как UNDERBEER: сессия эфемерная, состояние в payload (не в снимке БД), поэтому и список у них
// один и тот же — `SessionList` в `(admin)/_components`.

export default async function FearlessHome() {
  const sessions = await prisma.fearlessSession.findMany({ orderBy: { updatedAt: "desc" }, take: 50 });

  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Служебная часть · драфт героев"
        title="Fearless draft"
        aside={<NewFearlessButton />}
      >
        Драфт героев без повторов по серии: пул карты — по 9 случайных героев на атрибут, монетка
        решает сторону и очередь, дальше баны и пики по таймеру с банком доп-времени.
      </AdminHeader>

      <SessionList
        items={sessions.map((s) => ({
          id: s.id,
          title: s.title || `Драфт #${s.id}`,
          done: s.status === "done",
          updated: s.updatedAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }),
        }))}
        hrefBase="/admin/fearless-draft"
        apiBase="/api/fearless"
        emptyIcon="sword"
        emptyTitle="Драфтов пока нет"
        emptyHint="Нажмите «Новый драфт», выберите две команды — и монетка решит, кто выбирает сторону."
      />
    </div>
  );
}
