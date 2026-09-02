import { can } from "@/lib/account";
import { permissionLabel, type PermissionKey } from "@/lib/permissions";
import { FORM_MAX_W } from "@/components/pouf/blocks";
import { Alert } from "@/components/pouf/feedback";
import { AdminHeader } from "./admin-header";

// Гейт раздела служебной части по гранулярному праву.
//
// proxy пускает в /admin любого админа — это грубый гейт по роли. Конкретный раздел закрывает право
// (docs/archive/ACCOUNTS-PLAN.md §5): админ, который ведёт архив серий, не должен тратить деньги в студии.
// Отсутствие права — не ошибка, а нормальная ситуация: показываем плашку с названием права, чтобы
// человеку было что попросить у владельца, а не «доступ запрещён».
//
// Право здесь читается из БД, а не из куки: снял право — оно обязано пропасть сразу, а роль в куке
// живёт до следующего входа. Гейт страницы не заменяет гейта в экшене/роуте: страницу можно не
// открывать вовсе — поэтому каждый пишущий путь проверяет право у себя.

export async function denyUnlessPermission(key: PermissionKey, title: string) {
  if (await can(key)) return null;

  return (
    <main className={`mx-auto w-full ${FORM_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <AdminHeader title={title} />
      <Alert tone="warn" block className="mt-6">
        Раздел открывает право «{permissionLabel(key)}» (<code>{key}</code>). Попросите владельца лиги
        выдать его вашему аккаунту в разделе «Команда лиги».
      </Alert>
    </main>
  );
}
