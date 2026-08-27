// Только сервер / скрипт: диалог «Изменить данные» в боте — два шага (какое поле → новое значение)
// и правка уезжает в очередь модерации (`profile-edit.ts`).
//
// **Правит только тот, у кого есть настоящая привязка** `UserAccount.tgId` — её даёт регистрация в
// боте (`tg-register.ts`). Узнанному по хендлу правку не даём: хендл меняют, и освободившийся может
// занять посторонний — тогда чужой человек переписал бы профиль игрока. Ровно то же правило, что у
// выдачи кода входа (`tg-login.ts`): справочные разделы читают, а пишет только привязка.
//
// Шаги живут в общей `BotSession` под префиксом `pe_*` — как регистрация (`reg_*`) и анкеты
// (`form_*`): диалог у человека один. Состояние модуль возвращает наружу, пишет его `tg-quiz.ts`.

import { prisma } from "./prisma";
import type { Reply } from "./telegram";
import {
  EDIT_FIELDS,
  checkValue,
  currentValue,
  fieldByButton,
  fieldLabel,
  nicknameCooldownLeft,
  savePhoto,
  submitProfileEdit,
  type EditField,
} from "./profile-edit";

/** Шаг правки. Хранится в том же `BotSession.step`, что и шаги заявки — префикс их разводит. */
export type PeStep = "pe_field" | "pe_value";

export const isPeStep = (step: string): step is PeStep => step.startsWith("pe_");

/** Что уже выбрано. Значение не храним: оно приходит одним сообщением и сразу уезжает в очередь. */
export type PeState = { field: EditField | null };

export const EDIT_BUTTON = "Изменить данные";
const CANCEL = "Ничего не менять";

/** Служебные ответы этого сценария — ими нельзя случайно назваться на шаге со свободным текстом. */
export const PE_SERVICE = [EDIT_BUTTON, CANCEL, ...EDIT_FIELDS.map((f) => f.button)];

export const emptyEdit = (): PeState => ({ field: null });

export type PeResult = { replies: Reply[]; step?: PeStep; state: PeState; done?: boolean };

/** Клавиатура выбора поля: по два в ряд — на телефоне длинный столбец кнопок листать неудобно. */
function fieldButtons(): string[][] {
  const rows: string[][] = [];
  const labels = EDIT_FIELDS.map((f) => f.button);
  for (let i = 0; i < labels.length; i += 2) rows.push(labels.slice(i, i + 2));
  rows.push([CANCEL]);
  return rows;
}

/**
 * Профиль, который человек имеет право править: **только по привязке** `UserAccount.tgId`.
 * `identify` из `tg-menu.ts` здесь не годится — она нарочно шире (хендл, account_id из заявок) и
 * годится показывать, но не менять.
 */
export async function editablePlayer(tgId: string | null | undefined) {
  if (!tgId) return null;
  const account = await prisma.userAccount.findUnique({ where: { tgId }, select: { playerId: true } });
  if (!account?.playerId) return null;
  return prisma.player.findUnique({
    where: { id: account.playerId },
    select: {
      id: true,
      nickname: true,
      nicknameChangedAt: true,
      accountId: true,
      city: true,
      mmr: true,
      dotabuffUrl: true,
      stratzUrl: true,
      steamUrl: true,
      photo: true,
    },
  });
}

/** Вопрос шага — им же отвечаем на непонятый ответ и на возврат из меню (`askCurrent` в tg-quiz). */
export function askEdit(step: PeStep, state: PeState): Reply {
  if (step === "pe_field") return { text: "Что поправить в профиле?", keyboard: fieldButtons() };
  return askValue(state.field);
}

/** Чего ждём на шаге значения. Подсказка своя у каждого поля: «введите новое» ничему не помогает. */
function askValue(field: EditField | null): Reply {
  switch (field) {
    case "nickname":
      return { text: "Новый <b>ник</b>. Менять его можно примерно раз в сезон, так что без опечаток:", keyboard: null };
    case "city":
      return { text: "Новый <b>город</b>:", keyboard: null };
    case "mmr":
      return { text: "<b>MMR</b> — числом. Он заявленный, его проверит организатор:", keyboard: null };
    case "dotabuffUrl":
      return { text: "Ссылка на <b>Dotabuff</b>:\nhttps://www.dotabuff.com/players/123456", keyboard: null };
    case "stratzUrl":
      return { text: "Ссылка на <b>Stratz</b>:\nhttps://stratz.com/players/123456", keyboard: null };
    case "steamUrl":
      return { text: "Ссылка на <b>Steam</b>:", keyboard: null };
    case "photo":
      return {
        text: "Пришлите <b>фото</b> картинкой — портрет для карточки в ростере. Сжатием Telegram не " +
          "испортит: организатор увидит то же, что и вы.",
        keyboard: null,
      };
    default:
      // Поле потерялось (сессия пережила правку кода) — начинаем шаг заново, а не молчим.
      return { text: "Что поправить в профиле?", keyboard: fieldButtons() };
  }
}

/** Начать правку. Отказ объясняем: «нельзя» без причины выглядит поломкой. */
export async function startProfileEdit(tgId: string | null | undefined): Promise<PeResult> {
  const player = await editablePlayer(tgId);
  if (!player) {
    return {
      replies: [
        {
          text: "Править профиль я даю тому, кто заведён через меня — так я точно знаю, что это вы, " +
            "а не однофамилец по хендлу. Если вы в лиге давно, попросите организатора: он поправит сам.",
        },
      ],
      state: emptyEdit(),
      done: true,
    };
  }
  return { replies: [askEdit("pe_field", emptyEdit())], step: "pe_field", state: emptyEdit() };
}

/** Шаг правки. Возвращает состояние наружу — пишет его вызывающий (`tg-quiz.ts`). */
export async function handleProfileEdit(
  step: PeStep,
  state: PeState,
  text: string,
  ctx: { chatId: string; tgId: string | null | undefined; photoFileId?: string | null },
): Promise<PeResult> {
  const player = await editablePlayer(ctx.tgId);
  // Привязку могли снять, пока человек думал: молча писать в чужой профиль нельзя.
  if (!player) return { replies: [{ text: "Не вижу вашей привязки к профилю — начните заново с /start." }], state, done: true };

  if (step === "pe_field") {
    if (text === CANCEL) return { replies: [{ text: "Хорошо, ничего не меняем." }], state, done: true };

    const field = fieldByButton(text);
    if (!field) return { replies: [{ text: "Не понял, какое поле — выберите кнопкой." }, askEdit("pe_field", state)], step, state };

    // Кулдаун ника проверяем здесь, а не после ввода: заставить придумать ник и только потом
    // сказать «нельзя ещё 40 дней» — худший из возможных порядков.
    if (field === "nickname") {
      const left = nicknameCooldownLeft(player.nicknameChangedAt);
      if (left > 0) {
        return {
          replies: [
            { text: `Ник в этом сезоне уже менялся — сменить снова можно через ${left} дн. Раньше — только через организатора.` },
            askEdit("pe_field", state),
          ],
          step,
          state,
        };
      }
    }

    const next: PeState = { field };
    const now = currentValue(player, field);
    return {
      replies: [
        { text: `Сейчас в профиле: ${field === "photo" ? (now ? "фото есть" : "фото нет") : now ? `<b>${now}</b>` : "пусто"}` },
        askValue(field),
      ],
      step: "pe_value",
      state: next,
    };
  }

  // ── новое значение ──
  const field = state.field;
  if (!field) return { replies: [askEdit("pe_field", state)], step: "pe_field", state: emptyEdit() };

  let value: string;
  if (field === "photo") {
    if (!ctx.photoFileId) return { replies: [{ text: "Жду именно картинку — пришлите фото сообщением." }], step, state };
    try {
      value = await savePhoto(ctx.photoFileId);
    } catch (e) {
      console.error("Не сохранилось фото из телеграма:", e);
      return { replies: [{ text: "Не получилось забрать картинку. Попробуйте прислать ещё раз." }], step, state };
    }
  } else {
    // Кнопка прошлого шага висит до отмены — «Город» в ответ на «новый ник» это нажатие, а не ник.
    if (PE_SERVICE.includes(text.trim())) {
      return { replies: [{ text: `«${text}» — это кнопка прошлого шага. Наберите новое значение:` }], step, state };
    }
    const checked = checkValue(field, text);
    if (!checked.ok) return { replies: [{ text: checked.error }, askValue(field)], step, state };
    value = checked.value;
  }

  const failed = await submitProfileEdit({ playerId: player.id, field, value, chatId: ctx.chatId });
  if (failed) return { replies: [{ text: failed }], state, done: true };

  return {
    replies: [
      {
        text: `Правка отправлена организатору: <b>${fieldLabel(field)}</b>. Как решит — напишу сюда.`,
      },
    ],
    state,
    done: true,
  };
}
