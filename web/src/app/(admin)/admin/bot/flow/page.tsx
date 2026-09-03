import { flowActionList, flowRegistries, flowSubflowList } from "@/lib/bot-flow/registries";
import { editorFlow, listVersions } from "@/lib/bot-flow/store";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { AdminHeader } from "../../../_components/admin-header";
import { denyUnlessPermission } from "../../../_components/permission-gate";
import { FlowEditor } from "./_components/flow-editor";

export const metadata = { title: "Флоу бота" };
export const dynamic = "force-dynamic";

// Редактор графа диалога бота: ноды, связи, черновик и версии (`BOT-FLOW-PLAN.md` Э2), проверка и
// симулятор (Э3). С Э6 граф — единственный путь бота: опубликованная версия и есть то, что
// человек видит в телеграме, флага и старого рукописного пути за ней больше нет.
//
// Отдельным маршрутом, а не третьей вкладкой /admin/bot: у вкладок там колонка чтения (READ_MAX_W)
// и форма на форме, а канвасу нужна вся ширина витрины. Право то же — отдельного у бота нет.
//
// Реестры (`ctx.*`, `settings.*`, действия, модули) собираются здесь и едут в редактор пропсом: они живут в
// серверных модулях (`bot-flow/context.ts` тянет prisma), и импортировать их с клиента значило бы
// утащить в браузер половину рантайма бота. Из них же валидатор узнаёт, что существует, а что
// опечатка.

export default async function BotFlowPage() {
  const denied = await denyUnlessPermission("tournaments.edit", "Флоу бота");
  if (denied) return denied;

  const [state, versions] = await Promise.all([editorFlow(), listVersions()]);

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <AdminHeader crumbs={[{ href: "/admin/bot", label: "Телеграм-бот" }]} title="Флоу бота">
        Структура диалога нодами: что бот говорит, какие кнопки показывает и куда ведёт каждая из них.
        Правки копятся в черновике — бот продолжает говорить версией из эфира, пока её не заменят.
      </AdminHeader>

      <FlowEditor
        initialGraph={state.graph}
        initialNote={state.note}
        source={state.source}
        versions={versions}
        registries={flowRegistries()}
        actions={flowActionList()}
        subflows={flowSubflowList()}
      />
    </main>
  );
}
