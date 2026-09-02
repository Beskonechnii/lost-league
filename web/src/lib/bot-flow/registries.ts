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
import type { FlowRegistries } from "./validate";

/** Реестры одним объектом. Простые строки и массивы — их можно отдать клиентскому компоненту. */
export const flowRegistries = (): FlowRegistries => ({
  ctxKeys: CTX_KEYS,
  // Для графа реестр текстов и реестр таймингов — одна область: оператору важно значение, а не то,
  // в какой таблице оно лежит (`context.ts` → `settings`).
  settingKeys: [...QUIZ_SLOTS.map((s) => s.key as string), ...BOT_SETTINGS.map((f) => f.key as string)],
  actions: Object.entries(FLOW_ACTIONS).map(([name, a]) => ({ name, provides: a.provides })),
});
