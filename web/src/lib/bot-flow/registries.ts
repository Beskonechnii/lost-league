// Только сервер: что валидатор и редактор считают «существующим» — какие бывают `ctx.*`, какие
// `settings.*` и какие действия зарегистрированы.
//
// Отдельным файлом, потому что источники разъехались по серверным модулям (`context.ts` тянет
// prisma, тайминги — `bot-settings.ts`), а нужны они в двух
// местах сразу: страница редактора отдаёт их в браузер пропсом (подсказки и разбор графа на лету),
// экшен публикации сверяется с ними у себя. Собирать этот список в двух местах значило бы
// разъехаться на первой же новой переменной.

import { BOT_SETTINGS } from "../bot-settings";
import { FLOW_ACTIONS } from "./actions";
import { CTX_KEYS } from "./context";
import { entryHooks } from "./router";
import { liveFlows } from "./store";
import { FLOW_SUBFLOWS } from "./subflows";
import type { FlowNeighbour, FlowRegistries } from "./validate";

/** Реестры одним объектом. Простые строки и массивы — их можно отдать клиентскому компоненту. */
export const flowRegistries = (): FlowRegistries => ({
  ctxKeys: CTX_KEYS,
  // С Э6 в области `settings.*` остались только тайминги и тексты уведомлений: формулировки шагов
  // диалога переехали в свойства нод, второго реестра текстов больше нет.
  settingKeys: BOT_SETTINGS.map((f) => f.key as string),
  actions: Object.entries(FLOW_ACTIONS).map(([name, a]) => ({ name, provides: a.provides })),
  subflows: Object.keys(FLOW_SUBFLOWS).map((name) => ({ name })),
});

/**
 * Соседи по набору флоу (Э7): все живые графы, кроме правимого. Ходит в базу, поэтому отдельно от
 * `flowRegistries` — та синхронная и её зовут в браузере на каждой правке.
 */
export async function flowNeighbours(key: string): Promise<FlowNeighbour[]> {
  const flows = await liveFlows();
  return flows
    .filter((f) => f.key !== key)
    .map((f) => ({
      key: f.key,
      title: f.graph.title,
      main: !!f.graph.entry?.main,
      // Ловят чужой флоу его точки входа, а не перехваты: перехват принадлежит разговору внутри
      // графа, а вход — тому, как в граф попадают снаружи, и вот он-то и может столкнуться.
      matches: entryHooks(f).map((h) => h.match),
    }));
}

/**
 * Действия для инспектора ноды: подпись, пояснение и обязательные параметры. Отдельно от
 * `flowRegistries` — тому нужны только имена (он служит валидатору), а редактору нужны ещё и слова
 * человеку. Тянуть в браузер сам `FLOW_ACTIONS` нельзя: за ним весь рантайм бота с prisma.
 */
export type FlowActionInfo = { name: string; label: string; hint?: string; params?: string[] };

export const flowActionList = (): FlowActionInfo[] =>
  Object.entries(FLOW_ACTIONS).map(([name, a]) => ({ name, label: a.label, hint: a.hint, params: a.params }));

/**
 * Модули для инспектора ноды `subflow` — тем же форматом, что и действия: инспектор рисует их
 * одинаково (список из реестра + параметры), и второй тип ради одного и того же был бы лишним.
 */
export const flowSubflowList = (): FlowActionInfo[] =>
  Object.entries(FLOW_SUBFLOWS).map(([name, s]) => ({ name, label: s.label, hint: s.hint, params: s.params }));
