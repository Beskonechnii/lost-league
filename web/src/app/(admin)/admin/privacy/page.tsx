import { FORM_MAX_W } from "@/components/pouf/blocks";
import { Alert } from "@/components/pouf/feedback";
import { currentAccount, effectiveRole } from "@/lib/account";
import { readPrivacy } from "@/lib/privacy";
import { AdminHeader } from "../../_components/admin-header";
import { denyUnlessPermission } from "../../_components/permission-gate";
import { PrivacyAdmin } from "./_components/privacy-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Приватность витрины" };

// Экран показа: что из данных игроков лига отдаёт наружу. Право `privacy` открывает ПРОСМОТР —
// оператор работает с телеграмом и MMR в модерации и импорте, и без этого экрана вопрос «почему
// на витрине нет MMR» уходит к разработчику. Менять значения может только владелец
// (`OWNER_EMAIL`): прецедент разделения «раздел по праву, действие по владельцу» — /admin/staff.

export default async function PrivacyPage() {
  const denied = await denyUnlessPermission("privacy", "Приватность витрины");
  if (denied) return denied;

  const [{ value, ok }, me] = await Promise.all([readPrivacy(), currentAccount()]);
  const isOwner = me != null && effectiveRole(me) === "owner";

  return (
    <main className={`mx-auto w-full ${FORM_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <AdminHeader eyebrow="Служебная часть · показ" title="Приватность витрины">
        Что из данных игроков видно на публичной части, в открытых API и в ответах бота. Служебная
        часть, модерация и редакторы ростера видят эти поля всегда.
      </AdminHeader>

      <div className="mt-6 space-y-4">
        {!ok && (
          <Alert tone="warn" block>
            Настройку прочитать не удалось — витрина работает как «скрыто». Сохранение перезапишет
            значение.
          </Alert>
        )}
        {!isOwner && (
          <Alert tone="info" block>
            Показ переключает владелец лиги (<code>OWNER_EMAIL</code>). Здесь видно, что открыто сейчас.
          </Alert>
        )}
        <PrivacyAdmin initial={value} canEdit={isOwner} />
      </div>
    </main>
  );
}
