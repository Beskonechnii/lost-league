import { denyUnlessPermission } from "../../../_components/permission-gate";
import { AdminHeader } from "../../../_components/admin-header";
import { CrmImportForm } from "./crm-import-form";
import { FORM_MAX_W } from "@/components/pouf/blocks";

export const dynamic = "force-dynamic";
export const metadata = { title: "Импорт CRM" };

// Веб-версия scripts/import-crm.ts: обогащение уже существующих игроков лиги (телеграм, дата
// рождения, город/страна, account_id) из выгрузки CRM. Новых профилей не заводит и составы не
// трогает — отдельная фича от импорта составов (admin/tournaments/[slug]/import), см. BACKLOG.md.

export default async function CrmImportPage() {
  const denied = await denyUnlessPermission("roster.edit", "Импорт CRM");
  if (denied) return denied;

  return (
    <main className={`mx-auto w-full ${FORM_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <AdminHeader crumbs={[{ href: "/admin/roster/import", label: "Импорт составов" }]} title="Импорт CRM">
        Дозаполняет анкеты уже существующих игроков лиги: телеграм, дату рождения, город и страну,
        account_id. Новых игроков не заводит — их нет в CRM смысла искать, для этого есть импорт
        составов. В профиль ничего не попадёт, пока вы не дойдёте до шага «Запись».
      </AdminHeader>

      <div className="mt-6">
        <CrmImportForm />
      </div>
    </main>
  );
}
