import { SITE_MAX_W } from "@/components/pouf/blocks";
import { KitShowcase } from "./_components/kit-showcase";

export const metadata = { title: "Кит" };

// Витрина атомов Кита. Данных и прав не требует — на странице нет ничего, кроме самих
// компонентов, поэтому и `denyUnlessPermission` здесь нет. В навигацию админки не выводится:
// адрес знает тот, кто работает с Китом.

export default function KitPage() {
  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <KitShowcase />
    </main>
  );
}
