import { BOT_SETTINGS } from "@/lib/bot-settings";
import { CTX_KEYS } from "@/lib/bot-flow/context";
import { editorFlow, listVersions } from "@/lib/bot-flow/store";
import { QUIZ_SLOTS } from "@/lib/quiz-config";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { Alert } from "@/components/pouf/feedback";
import { AdminHeader } from "../../../_components/admin-header";
import { denyUnlessPermission } from "../../../_components/permission-gate";
import { FlowEditor } from "./_components/flow-editor";

export const metadata = { title: "Флоу бота" };
export const dynamic = "force-dynamic";

// Редактор графа диалога бота: ноды, связи, черновик и версии (`BOT-FLOW-PLAN.md` Э2).
//
// Отдельным маршрутом, а не третьей вкладкой /admin/bot: у вкладок там колонка чтения (READ_MAX_W)
// и форма на форме, а канвасу нужна вся ширина витрины. Право то же — отдельного у бота нет.
//
// Подсказки ссылок (`ctx.*`, `settings.*`) собираются здесь и едут в редактор пропсом: их реестры
// живут в серверных модулях (`bot-flow/context.ts` тянет prisma), и импортировать их с клиента
// значило бы утащить в браузер половину рантайма бота.

export default async function BotFlowPage() {
  const denied = await denyUnlessPermission("tournaments.edit", "Флоу бота");
  if (denied) return denied;

  const [state, versions] = await Promise.all([editorFlow(), listVersions()]);
  const settingKeys = [...QUIZ_SLOTS.map((s) => s.key as string), ...BOT_SETTINGS.map((f) => f.key as string)];

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <AdminHeader crumbs={[{ href: "/admin/bot", label: "Телеграм-бот" }]} title="Флоу бота">
        Структура диалога нодами: что бот говорит, какие кнопки показывает и куда ведёт каждая из них.
        Правки копятся в черновике — бот продолжает говорить версией из эфира, пока её не заменят.
      </AdminHeader>

      {/* Пока флаг выключен, граф правится «в стол»: бот идёт старым рукописным путём. Молчать об
          этом нельзя — оператор опубликует версию и не поймёт, почему в телеграме ничего не изменилось. */}
      {process.env.BOT_FLOW !== "1" && (
        <Alert tone="warn" block className="mt-5">
          Флоу выключен: в окружении сервера нет <code>BOT_FLOW=1</code>, и бот сейчас работает старым путём.
          Править и публиковать граф можно — в эфир он попадёт после включения флага и перезапуска бота.
        </Alert>
      )}

      <FlowEditor
        initialGraph={state.graph}
        initialNote={state.note}
        source={state.source}
        versions={versions}
        ctxKeys={CTX_KEYS}
        settingKeys={settingKeys}
      />
    </main>
  );
}
