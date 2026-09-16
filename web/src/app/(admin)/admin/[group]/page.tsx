import { notFound } from "next/navigation";
import { TOOL_GROUPS, groupHref, toolGroupsFor } from "@/app/_components/tools";
import { TileGrid } from "@/app/_components/hub-tiles";
import { currentPermissions } from "@/lib/account";
import { permissionLabel } from "@/lib/permissions";
import { FORM_MAX_W, SITE_MAX_W } from "@/components/pouf/blocks";
import { Alert } from "@/components/pouf/feedback";
import { PillLink } from "@/components/pouf/tabs";
import { AdminHeader } from "../../_components/admin-header";
import { queueBadges } from "../_queues";

export const dynamic = "force-dynamic";

// Страница группы инструментов (ТЗ 27). Маршрут один на все группы и берёт их из реестра
// `_components/tools.ts` — второго списка не заводится: инструмент, добавленный строкой в реестр,
// встаёт на свою страницу сам.
//
// Слаги групп не пересекаются с сегментами инструментов (`/admin/moderation`, `/admin/tp`, …):
// статический сегмент в Next выигрывает у динамического, и совпадение спрятало бы страницу группы.

const bySlug = (slug: string) => TOOL_GROUPS.find((g) => g.slug === slug);

export async function generateMetadata({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  // Неизвестный слаг уходит в notFound(), но метаданные считаются раньше — своего имени
  // несуществующей группе не выдумываем.
  return { title: bySlug(group)?.title ?? "Страница не найдена" };
}

export default async function ToolGroupPage({ params }: { params: Promise<{ group: string }> }) {
  const { group: slug } = await params;
  const group = bySlug(slug);
  if (!group) notFound();

  const perms = await currentPermissions();
  const tools = group.tools.filter((t) => perms.includes(t.perm));

  // Право решает не только витриной: прямой заход в чужую группу даёт отказ с перечислением прав,
  // а не пустой экран. Человеку нужно знать, что просить у владельца.
  if (tools.length === 0) {
    const need = [...new Set(group.tools.map((t) => t.perm))];
    return (
      <main className={`mx-auto w-full ${FORM_MAX_W} flex-1 px-4 py-8 md:px-6`}>
        <AdminHeader title={group.title} />
        <Alert tone="warn" block className="mt-6">
          Группу открывает любое из прав: {need.map((k) => `«${permissionLabel(k)}»`).join(", ")}. Попросите
          владельца лиги выдать нужное вашему аккаунту в разделе «Команда лиги».
        </Alert>
      </main>
    );
  }

  const { counts } = await queueBadges(perms);
  // Соседи — только доступные группы: ссылка на то, куда не пустят, хуже её отсутствия.
  const others = toolGroupsFor(perms).filter((g) => g.slug !== group.slug);

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <AdminHeader title={group.title}>{group.desc}</AdminHeader>
      <div className="mt-8">
        <TileGrid tiles={tools.map((t) => (counts[t.href] ? { ...t, badge: counts[t.href] } : t))} />
      </div>

      {others.length > 0 && (
        // Соседние группы в один клик — это тело страницы, а не хром: над данными
        // по-прежнему только бар и заголовок, второго ряда навигации не появляется.
        <nav aria-label="Другие группы" className="mt-10 flex flex-wrap items-center gap-2 font-pouf">
          <span className="text-xs font-black uppercase tracking-[0.18em] text-muted">Другие группы</span>
          {others.map((g) => (
            <PillLink key={g.slug} href={groupHref(g)}>
              {g.title}
            </PillLink>
          ))}
        </nav>
      )}
    </main>
  );
}
