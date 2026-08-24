import type { Metadata } from "next";
import { AdminNav } from "../_components/site-nav";
import { AdminSidebar } from "./_components/admin-sidebar";
import { toolGroupsFor } from "./_components/tools";
import { isAdmin } from "@/lib/admin-session";
import { currentPermissions, pendingClaims, pendingRegistrations } from "@/lib/account";

// Служебная часть: студия графики, правка ростера, вход. Всё это закрыто ролью и правами
// (`needsAdmin()` в src/lib/auth.ts) и посетителю не показывается.
//
// noindex — не защита, а гигиена: страницы и так за паролем, но светиться в выдаче им незачем.
//
// Список инструментов стоит слева постоянно (UI-GUIDELINES §5): у оператора не просмотр, а работа,
// и переход между двумя инструментами не должен идти через хаб. Поэтому кнопки «Назад» здесь больше
// нет — возвращаться некуда, всё видно всегда.

export const metadata: Metadata = {
  title: { default: "Админка — LOST", template: "%s — админка LOST" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const perms = await currentPermissions();
  const groups = toolGroupsFor(perms);

  // Число новых в очереди считаем только тому, кто её и так видит — остальным запрос ни к чему.
  const [queue, claims] = perms.includes("accounts.approve")
    ? await Promise.all([pendingRegistrations(), pendingClaims()])
    : [[], []];

  return (
    <>
      <AdminNav isAdmin={await isAdmin()} />
      <div className="flex flex-col lg:flex-row">
        {groups.length > 0 && <AdminSidebar groups={groups} pending={queue.length + claims.length} />}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </>
  );
}
