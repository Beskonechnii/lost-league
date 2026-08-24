import { HubGroupedTiles } from "@/app/_components/hub-tiles";
import { currentPermissions, pendingClaims, pendingRegistrations } from "@/lib/account";
import { QUEUE_TOOL, toolGroupsFor } from "../_components/tools";
import { SITE_MAX_W } from "@/app/_components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Инструменты" };

// Домашняя операторской. Единственный хаб-из-плиток, который стандарт разрешает (UI-GUIDELINES §0,
// принцип 1): он верхний и заодно объясняет инструменты описанием, чего узкий сайдбар не может.
// Список берётся из общего реестра (_components/tools.ts) — того же, что кормит сайдбар.

export default async function AdminHome() {
  const perms = await currentPermissions();
  const canApprove = perms.includes("accounts.approve");
  const [queue, claims] = canApprove
    ? await Promise.all([pendingRegistrations(), pendingClaims()])
    : [[], []];
  const pending = queue.length + claims.length;

  const groups = toolGroupsFor(perms).map((g) => ({
    title: g.title,
    tiles: g.tools.map((t) => (t.href === QUEUE_TOOL && pending > 0 ? { ...t, badge: pending } : t)),
  }));

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <HubGroupedTiles eyebrow="Служебная часть" title="Инструменты" groups={groups} />
      {groups.length === 0 && (
        <p className="mt-6 rounded-md border border-amber-900 bg-amber-950/40 px-3 py-2 text-sm text-amber-300">
          Роль админа есть, а прав пока нет: попросите владельца лиги отметить нужные разделы в
          «Команде лиги».
        </p>
      )}
    </main>
  );
}
