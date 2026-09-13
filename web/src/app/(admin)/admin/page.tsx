import { HubGroupedTiles } from "@/app/_components/hub-tiles";
import { currentPermissions } from "@/lib/account";
import { moderationQueues } from "@/lib/moderation";
import { duplicatesCount } from "@/lib/duplicates";
import { DUPLICATES_TOOL, QUEUE_TOOL, toolGroupsFor } from "@/app/_components/tools";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { Alert } from "@/components/pouf/feedback";

export const dynamic = "force-dynamic";
export const metadata = { title: "Инструменты" };

// Домашняя операторской. Единственный хаб-из-плиток, который стандарт разрешает (UI-GUIDELINES §0,
// принцип 1): он верхний и заодно объясняет инструменты описанием, чего пилюля в баре не может.
// С ТЗ 08 хаб — единственная навигация по инструментам: в баре на него ведёт один пункт «Админ»,
// а список плиток берётся из общего реестра `_components/tools.ts`.

export default async function AdminHome() {
  const perms = await currentPermissions();
  const mayEdit = perms.includes("roster.edit");

  // Очередь считаем тем же вызовом, что и сама /admin/moderation: число на плитке — обещание,
  // и оно должно совпасть со списком, который человек там увидит.
  const pending = perms.includes("accounts.approve") ? (await moderationQueues(mayEdit)).total : 0;
  // Дубли — вторая очередь под правом roster.edit. Оба индикатора жили в удалённом сайдбаре;
  // на хабе они на плитках своих инструментов.
  const duplicates = mayEdit ? await duplicatesCount() : 0;
  const badges: Record<string, number> = { [QUEUE_TOOL]: pending, [DUPLICATES_TOOL]: duplicates };

  const groups = toolGroupsFor(perms).map((g) => ({
    title: g.title,
    tiles: g.tools.map((t) => (badges[t.href] ? { ...t, badge: badges[t.href] } : t)),
  }));

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <HubGroupedTiles eyebrow="Служебная часть" title="Инструменты" groups={groups} />
      {groups.length === 0 && (
        <Alert tone="warn" block className="mt-6">
          Роль админа есть, а прав пока нет: попросите владельца лиги отметить нужные разделы в
          «Команде лиги».
        </Alert>
      )}
    </main>
  );
}
