// Только сервер: что валидатор и редактор считают «существующим» — какие бывают `ctx.*`, какие
// `settings.*` и какие действия зарегистрированы.
//
// Отдельным файлом, потому что источники разъехались по серверным модулям (`context.ts` тянет
// prisma, тексты живут в `quiz-config.ts`, тайминги — в `bot-settings.ts`), а нужны они в двух
// местах сразу: страница редактора отдаёт их в браузер пропсом (подсказки и разбор графа на лету),
// экшен публикации сверяется с ними у себя. Собирать этот список в двух местах значило бы
// разъехаться на первой же новой переменной.

import { BOT_SETTINGS } from "../bot-settings";
import { QUIZ_SLOTS } from "../quiz-config";
import { FLOW_ACTIONS } from "./actions";
import { CTX_KEYS } from "./context";
import { FLOW_SUBFLOWS } from "./subflows";
import type { FlowRegistries } from "./validate";

/** Реестры одним объектом. Простые строки и массивы — их можно отдать клиентскому компоненту. */
export const flowRegistries = (): FlowRegistries => ({
  ctxKeys: CTX_KEYS,
  // Для графа реестр текстов и реестр таймингов — одна область: оператору важно значение, а не то,
  // в какой таблице оно лежит (`context.ts` → `settings`).
  settingKeys: [...QUIZ_SLOTS.map((s) => s.key as string), ...BOT_SETTINGS.map((f) => f.key as string)],
  actions: Object.entries(FLOW_ACTIONS).map(([name, a]) => ({ name, provides: a.provides })),
  subflows: Object.keys(FLOW_SUBFLOWS).map((name) => ({ name })),
});

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
