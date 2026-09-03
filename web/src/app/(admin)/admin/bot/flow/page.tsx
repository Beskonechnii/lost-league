import Link from "next/link";
import { FLOW_KEY } from "@/lib/bot-flow/default-flow";
import { flowActionList, flowNeighbours, flowRegistries, flowSubflowList } from "@/lib/bot-flow/registries";
import { editorFlow, listFlowKeys, listVersions } from "@/lib/bot-flow/store";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { Button } from "@/components/pouf/Button";
import { AdminHeader } from "../../../_components/admin-header";
import { denyUnlessPermission } from "../../../_components/permission-gate";
import { FlowEditor } from "./_components/flow-editor";

export const metadata = { title: "Флоу бота" };
export const dynamic = "force-dynamic";

// Редактор графа диалога бота: ноды, связи, черновик и версии (`BOT-FLOW-PLAN.md` Э2), проверка и
// симулятор (Э3). С Э6 граф — единственный путь бота: опубликованная версия и есть то, что
// человек видит в телеграме, флага и старого рукописного пути за ней больше нет.
//
// С Э7 граф не один: какой правим — в адресе (`?flow=main`), список ключей и соседние флоу приезжают
// с сервера. Соседи нужны проверке: два графа не могут ловить одну кнопку и оба быть главными.
//
// Отдельным маршрутом, а не третьей вкладкой /admin/bot: у вкладок там колонка чтения (READ_MAX_W)
// и форма на форме, а канвасу нужна вся ширина витрины. Право то же — отдельного у бота нет.
//
// Реестры (`ctx.*`, `settings.*`, действия, модули) собираются здесь и едут в редактор пропсом: они живут в
// серверных модулях (`bot-flow/context.ts` тянет prisma), и импортировать их с клиента значило бы
// утащить в браузер половину рантайма бота. Из них же валидатор узнаёт, что существует, а что
// опечатка.

export default async function BotFlowPage({ searchParams }: { searchParams: Promise<{ flow?: string }> }) {
  const denied = await denyUnlessPermission("tournaments.edit", "Флоу бота");
  if (denied) return denied;

  // Какой флоу правим (Э7). Ключ в адресе, а не в состоянии редактора: по ссылке на конкретный
  // граф удобно возвращаться, а перезагрузка страницы не должна кидать оператора обратно в меню.
  const key = (await searchParams).flow?.trim() || FLOW_KEY;
  const [state, versions, keys, neighbours] = await Promise.all([
    editorFlow(key),
    listVersions(key),
    listFlowKeys(),
    flowNeighbours(key),
  ]);

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <AdminHeader
        crumbs={[{ href: "/admin/bot", label: "Телеграм-бот" }]}
        title="Флоу бота"
        // Дорожка к гайду — действием у заголовка (UI-GUIDELINES §4), а не строкой в подвале: его
        // ищут в первую минуту знакомства с экраном, а не после того, как всё уже собрано.
        aside={
          <Link href="/admin/bot/flow/guide">
            <Button type="button" size="sm" variant="quiet">
              Как это устроено
            </Button>
          </Link>
        }
      >
        Структура диалога нодами: что бот говорит, какие кнопки показывает и куда ведёт каждая из них.
        Правки копятся в черновике — бот продолжает говорить версией из эфира, пока её не заменят.
        Первый раз здесь — начните с гайда «Как это устроено».
      </AdminHeader>

      <FlowEditor
        key={key}
        flowKey={key}
        flowKeys={keys}
        initialGraph={state.graph}
        initialNote={state.note}
        source={state.source}
        versions={versions}
        registries={{ ...flowRegistries(), flows: neighbours }}
        actions={flowActionList()}
        subflows={flowSubflowList()}
      />
    </main>
  );
}
