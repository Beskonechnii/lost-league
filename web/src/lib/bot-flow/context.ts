// Только сервер / скрипт: значения, из которых граф диалога берёт подстановки и условия.
//
// Три области различаются префиксом:
//   • `vars.*`     — собранное этим диалогом, живёт в сессии (`BotSession.flowVars`);
//   • `ctx.*`      — вычисленный контекст сообщения, только чтение (кто написал, знает ли его лига);
//   • `settings.*` — тексты и тайминги из нынешних реестров (`quiz-config.ts`, `bot-settings.ts`).
//
// **Контекст считается лениво и один раз на сообщение.** Нода спрашивает то, что ей нужно, — и
// только это уходит в БД: иначе каждое «привет» стоило бы опознания игрока, списка турниров и
// проверки открытых анкет разом.

import { prisma } from "../prisma";
import { loadBotSettings, isBotSettingKey } from "../bot-settings";
import { isQuizKey, loadQuiz } from "../quiz-config";
import { anyFormOpen } from "../tg-forms";
import { identify } from "../tg-menu";
import { registrationOpen } from "../tournaments";
import type { FlowCondition, FlowRef } from "./types";

/** Сообщение, на которое отвечаем. Ровно то, что знает о человеке `handleMessage`. */
export type FlowMessage = {
  chatId: string;
  text: string;
  username?: string | null;
  tgId?: string | null;
};

/** Логическое значение в графе — словом: оператор пишет условие руками, `true` ему ни о чём не говорит. */
const yesNo = (value: boolean): string => (value ? "да" : "нет");

/**
 * Провайдеры `ctx.*`. Каждый — один вопрос к БД, и зовётся он, только если на него сослались.
 * Порядок в объекте — порядок подсказки в редакторе (Э2).
 */
const CTX: Record<string, (m: FlowMessage, mem: Memo) => Promise<string>> = {
  chatId: async (m) => m.chatId,
  tgId: async (m) => m.tgId ?? "",
  username: async (m) => m.username ?? "",
  текст: async (m) => m.text,
  известен: async (m, mem) => yesNo((await mem.players(m)).length > 0),
  игрок: async (m, mem) => {
    const ids = await mem.players(m);
    if (!ids.length) return "";
    const player = await prisma.player.findFirst({ where: { id: { in: ids } }, select: { nickname: true } });
    return player?.nickname ?? "";
  },
  капитан: async (m, mem) => {
    const ids = await mem.players(m);
    if (!ids.length) return "нет";
    const spot = await prisma.rosterSpot.findFirst({ where: { playerId: { in: ids }, isCaptain: true }, select: { id: true } });
    return yesNo(!!spot);
  },
  открытые_турниры: async () => {
    const all = await prisma.tournament.findMany({ where: { status: "registration" }, orderBy: { id: "desc" } });
    return String(all.filter(registrationOpen).length);
  },
  есть_анкеты: async () => yesNo(await anyFormOpen()),
};

/** Что можно написать после `ctx.` — редактору и валидатору (Э2, Э3). */
export const CTX_KEYS: string[] = Object.keys(CTX);

/** Память на одно сообщение: опознание игрока нужно трём провайдерам, а запрос у них общий. */
type Memo = { players: (m: FlowMessage) => Promise<number[]> };

/**
 * Область видимости графа на одно сообщение: читает значение по ссылке и подставляет его в текст.
 * Живёт ровно столько, сколько идёт разбор сообщения, — на нём же и кеширует.
 */
export type FlowScope = {
  /** Значение по ссылке. `undefined` — такой ссылки нет (опечатка оператора). */
  get: (ref: FlowRef) => Promise<string | undefined>;
  /** Переменные диалога: интерпретатор их дописывает и сохраняет в сессию. */
  vars: Record<string, string>;
  /** Подстановка `{…}` в тексте ноды. */
  render: (text: string) => Promise<string>;
  /** Проверка условия ноды `if` или кнопки. */
  test: (cond: FlowCondition | null | undefined) => Promise<boolean>;
};

export function makeScope(msg: FlowMessage, vars: Record<string, string>): FlowScope {
  const cache = new Map<string, Promise<string>>();
  let players: Promise<number[]> | null = null;
  const memo: Memo = {
    players: (m) => (players ??= identify(m.chatId, m.username, m.tgId)),
  };

  const ctx = (name: string): Promise<string> | undefined => {
    const provider = CTX[name];
    if (!provider) return undefined;
    const hit = cache.get(name);
    if (hit) return hit;
    const value = provider(msg, memo);
    cache.set(name, value);
    return value;
  };

  const settings = async (name: string): Promise<string | undefined> => {
    // Реестр текстов вопросов и реестр таймингов — два разных источника, но для графа это одна
    // область: оператору важно значение, а не то, в какой таблице оно лежит.
    if (isQuizKey(name)) return (await loadQuiz()).text(name);
    if (isBotSettingKey(name)) return (await loadBotSettings()).raw(name);
    return undefined;
  };

  const get = async (ref: FlowRef): Promise<string | undefined> => {
    const at = ref.indexOf(".");
    if (at < 0) return undefined;
    const area = ref.slice(0, at).trim();
    const name = ref.slice(at + 1).trim();
    if (area === "vars") return vars[name];
    if (area === "ctx") return ctx(name);
    if (area === "settings") return settings(name);
    return undefined;
  };

  return {
    get,
    vars,
    /**
     * Подстановка фигурными скобками — тем же синтаксисом, что у текстов бота сегодня. Незнакомая
     * скобка остаётся текстом: опечатка оператора не должна ронять диалог. Внутрь подставленного
     * значения не заглядываем — иначе текст из настроек мог бы подставлять сам себя.
     */
    render: async (text: string): Promise<string> => {
      const names = [...text.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
      let out = text;
      for (const name of names) {
        const value = await get(name);
        if (value !== undefined) out = out.split(`{${name}}`).join(value);
      }
      return out;
    },
    test: async (cond): Promise<boolean> => {
      if (!cond) return true;
      const left = (await get(cond.left)) ?? "";
      const right = cond.right ?? "";
      switch (cond.op) {
        case "есть":
          return left.trim() !== "" && left.trim() !== "нет";
        case "нет":
          return left.trim() === "" || left.trim() === "нет";
        case "≠":
          return left.trim().toLowerCase() !== right.trim().toLowerCase();
        case ">":
        case "<": {
          // Сравнение чисел: у нечисловых значений ответ «нет» — это опечатка в условии, а не повод
          // падать посреди диалога.
          const [a, b] = [Number(left), Number(right)];
          if (Number.isNaN(a) || Number.isNaN(b)) return false;
          return cond.op === ">" ? a > b : a < b;
        }
        default:
          return left.trim().toLowerCase() === right.trim().toLowerCase();
      }
    },
  };
}
