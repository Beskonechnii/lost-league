import { can } from "@/lib/account";
import { permissionLabel, type PermissionKey } from "@/lib/permissions";
import { FORM_MAX_W } from "@/app/_components/ui";

// Гейт раздела служебной части по гранулярному праву.
//
// proxy пускает в /admin любого админа — это грубый гейт по роли. Конкретный раздел закрывает право
// (ACCOUNTS-PLAN.md §5): админ, который ведёт архив серий, не должен тратить деньги в студии.
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
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      <p className="mt-4 rounded-md border border-amber-900 bg-amber-950/40 px-3 py-2 text-sm text-amber-300">
        Раздел открывает право «{permissionLabel(key)}» (<code>{key}</code>). Попросите владельца лиги
        выдать его вашему аккаунту в разделе «Команда лиги».
      </p>
    </main>
  );
}
