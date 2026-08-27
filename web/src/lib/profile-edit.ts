// Только сервер / скрипт: очередь правок профиля игрока — то, что человек прислал из бота, а
// оператор подтверждает в /admin/moderation.
//
// Почему очередь, а не прямая запись. Бот сам ничего не публикует: всё, что пишет, проходит
// оператора (решение второй волны — ../../DECISIONS.md 27.08.2026). Разница с сайтом не в
// недоверии к человеку, а в том, что здесь правятся поля, которые лига проверяет глазами: MMR
// заявленный, фото — картинка, ник — ещё и лимитом ограничен.
//
// Без `server-only`: модуль зовёт бот (обычный node, `scripts/bot.ts`), как `team-application.ts`,
// `tg-register.ts` и `tg-login.ts`. Отсюда же следует, что `account.ts` сюда не импортируется —
// он `server-only` и в процессе бота не грузится вовсе. Права оператора проверяет вызывающий
// (server-action страницы модерации).

import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import { profileLinkProblem, MMR_MAX } from "./application";
import { accountIdFromUrl, uploadUrl } from "./profiles";
import { invalidateUploads } from "./uploads";
import { fetchFile } from "./telegram";

// ── лимит смены ника ─────────────────────────────────────────────────────────
//
// Правило одно на оба входа (кабинет на сайте и бот), поэтому живёт здесь, а не в `account.ts`:
// тот в бот не грузится. Формального «сезона» в модели нет (BACKLOG §1), поэтому приближаем
// скользящим окном.

export const NICKNAME_COOLDOWN_DAYS = 120;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Сколько дней ещё нельзя менять ник. 0 — можно. */
export function nicknameCooldownLeft(changedAt: Date | null | undefined, now = Date.now()): number {
  if (!changedAt) return 0;
  return Math.max(0, Math.ceil((changedAt.getTime() + NICKNAME_COOLDOWN_DAYS * DAY_MS - now) / DAY_MS));
}

// ── поля ─────────────────────────────────────────────────────────────────────
//
// Список закрытый: правится только то, что принадлежит человеку и что оператор может проверить.
// Позиции в составе, TP и номер сюда не входят — это решения лиги, а не анкета.

export const EDIT_FIELDS = [
  { key: "nickname", label: "Ник", button: "Ник" },
  { key: "city", label: "Город", button: "Город" },
  { key: "mmr", label: "MMR", button: "MMR" },
  { key: "dotabuffUrl", label: "Dotabuff", button: "Dotabuff" },
  { key: "stratzUrl", label: "Stratz", button: "Stratz" },
  { key: "steamUrl", label: "Steam", button: "Steam" },
  { key: "photo", label: "Фото", button: "Фото" },
] as const;

export type EditField = (typeof EDIT_FIELDS)[number]["key"];

const BY_KEY = new Map(EDIT_FIELDS.map((f) => [f.key as string, f]));
export const isEditField = (v: string): v is EditField => BY_KEY.has(v);
export const fieldLabel = (v: string): string => BY_KEY.get(v)?.label ?? v;
/** Поле по подписи кнопки — регистр и пробелы не значимы: ответ приезжает обычным сообщением. */
export const fieldByButton = (text: string): EditField | null =>
  (EDIT_FIELDS.find((f) => f.button.toLowerCase() === text.trim().toLowerCase())?.key as EditField) ?? null;

/** Профиль в том объёме, которого хватает и на проверку, и на «было → стало». */
type PlayerFields = {
  nickname: string;
  nicknameChangedAt: Date | null;
  accountId: string | null;
  city: string | null;
  mmr: number | null;
  dotabuffUrl: string | null;
  stratzUrl: string | null;
  steamUrl: string | null;
  photo: string | null;
};

const PLAYER_SELECT = {
  nickname: true,
  nicknameChangedAt: true,
  accountId: true,
  city: true,
  mmr: true,
  dotabuffUrl: true,
  stratzUrl: true,
  steamUrl: true,
  photo: true,
} as const;

/** Что стоит в профиле сейчас — строкой, как хранится в очереди. */
export function currentValue(player: PlayerFields, field: EditField): string | null {
  const raw = player[field];
  return raw == null ? null : String(raw);
}

// ── проверка нового значения ─────────────────────────────────────────────────

export type CheckResult = { ok: true; value: string } | { ok: false; error: string };

/** Ссылку приводим к единому виду — со схемой и без хвостовых слэшей, как `application.ts`. */
const normalizeLink = (raw: string): string => {
  const value = raw.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

/**
 * Годится ли присланное. Проверяем здесь, а не только у оператора: сказать «ссылка не разобрана»
 * человеку, который ещё в диалоге, дешевле, чем гонять правку через очередь ради отказа.
 * Фото сюда не попадает — оно приезжает картинкой, а не текстом (см. `savePhoto`).
 */
export function checkValue(field: EditField, raw: string): CheckResult {
  const text = raw.trim();
  switch (field) {
    case "nickname":
      return text ? { ok: true, value: text } : { ok: false, error: "Ник не может быть пустым." };
    case "city":
      return text ? { ok: true, value: text } : { ok: false, error: "Напишите город." };
    case "mmr": {
      const n = Number(text.replace(/\s+/g, ""));
      if (!Number.isInteger(n) || n < 0) return { ok: false, error: "MMR — целое число, например 4200." };
      if (n > MMR_MAX) return { ok: false, error: `MMR ${n} — это опечатка. Ждём число до ${MMR_MAX}.` };
      return { ok: true, value: String(n) };
    }
    case "dotabuffUrl":
    case "stratzUrl":
    case "steamUrl": {
      const kind = field === "dotabuffUrl" ? "dotabuff" : field === "stratzUrl" ? "stratz" : "steam";
      if (!text) return { ok: false, error: "Пришлите ссылку." };
      const problem = profileLinkProblem(kind, text);
      return problem ? { ok: false, error: problem } : { ok: true, value: normalizeLink(text) };
    }
    case "photo":
      return { ok: false, error: "Фото ждём картинкой, а не текстом." };
  }
}

// ── приём правки ─────────────────────────────────────────────────────────────

/**
 * Поставить правку в очередь. Возвращает текст претензии либо null.
 *
 * Одно поле — одна открытая правка: вторая на то же поле означала бы, что оператор одобряет
 * устаревшее значение вслед за свежим. Поэтому прежнюю не отклоняем молча, а просим дождаться.
 */
export async function submitProfileEdit(input: {
  playerId: number;
  field: EditField;
  value: string;
  chatId?: string | null;
}): Promise<string | null> {
  const player = await prisma.player.findUnique({ where: { id: input.playerId }, select: PLAYER_SELECT });
  if (!player) return "Профиль не найден.";

  const pending = await prisma.profileEditRequest.findFirst({
    where: { playerId: input.playerId, field: input.field, status: "pending" },
  });
  if (pending) return `Правка поля «${fieldLabel(input.field)}» уже у организатора — дождитесь решения.`;

  if (input.field === "nickname") {
    const left = nicknameCooldownLeft(player.nicknameChangedAt);
    if (left > 0) return `Ник в этом сезоне уже менялся. Сменить снова можно через ${left} дн. или попросить организатора.`;
  }

  const old = currentValue(player, input.field);
  if (old === input.value) return `В профиле уже так и записано — правка не нужна.`;

  await prisma.profileEditRequest.create({
    data: {
      playerId: input.playerId,
      field: input.field,
      oldValue: old,
      newValue: input.value,
      chatId: input.chatId ?? null,
    },
  });
  return null;
}

/**
 * Сохранить присланную картинку в `public/uploads/players` и вернуть путь. Кладём файл сразу, до
 * решения оператора: иначе ему нечего смотреть — а именно смотреть здесь и надо. Ровно так же
 * работает загрузка из админки (`/api/roster/upload`): файл появляется до сохранения формы.
 */
export async function savePhoto(fileId: string): Promise<string> {
  const { bytes, ext } = await fetchFile(fileId);
  const name = `${randomUUID()}${ext === ".jpeg" ? ".jpg" : ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "players");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), bytes);
  invalidateUploads("players"); // листинг папки закэширован — иначе фолбэк не увидит свежий файл
  return uploadUrl("players", name);
}

// ── очередь оператора ────────────────────────────────────────────────────────

/** Открытые правки, старые сверху: очередь разбирают по порядку прихода. */
export const pendingProfileEdits = () =>
  prisma.profileEditRequest.findMany({
    where: { status: "pending" },
    orderBy: { submittedAt: "asc" },
    include: { player: { select: { id: true, nickname: true, photo: true, slug: true } } },
  });

export type PendingProfileEdit = Awaited<ReturnType<typeof pendingProfileEdits>>[number];

/**
 * Одобрить: записать значение в `Player`. Права проверяет вызывающий — `account.ts` сюда не тянется.
 * Возвращает ошибку строкой либо null.
 */
export async function approveProfileEdit(id: number, reviewedById?: number | null): Promise<string | null> {
  const request = await prisma.profileEditRequest.findUnique({ where: { id } });
  if (!request) return "Правка не найдена";
  if (request.status !== "pending") return "Эта правка уже разобрана";
  if (!isEditField(request.field)) return `Неизвестное поле «${request.field}»`;

  const player = await prisma.player.findUnique({ where: { id: request.playerId }, select: PLAYER_SELECT });
  if (!player) return "Профиль не найден";

  const data: Record<string, unknown> = {};
  switch (request.field) {
    case "nickname":
      // slug не трогаем никогда: от него зависят имена файлов картинок (см. schema).
      data.nickname = request.newValue;
      data.nicknameChangedAt = new Date();
      break;
    case "city":
      data.city = request.newValue;
      break;
    case "mmr":
      data.mmr = Number(request.newValue);
      break;
    case "photo":
      data.photo = request.newValue;
      break;
    case "dotabuffUrl":
    case "stratzUrl":
    case "steamUrl": {
      data[request.field] = request.newValue;
      // account_id выводим из ссылки, только если его не было: перепривязать статистику человека
      // правкой одной ссылки нельзя — прежний id мог поставить оператор, и матчи потерялись бы.
      const derived = accountIdFromUrl(request.newValue);
      if (derived && !player.accountId) data.accountId = derived;
      break;
    }
  }

  await prisma.player.update({ where: { id: request.playerId }, data });
  await prisma.profileEditRequest.update({
    where: { id },
    data: { status: "approved", reviewedAt: new Date(), reviewedById: reviewedById ?? null },
  });
  if (request.field === "photo") invalidateUploads("players");
  return null;
}

/** Вернуть правку с причиной. Причина обязательна: без неё человеку нечего исправлять. */
export async function rejectProfileEdit(id: number, reason: string, reviewedById?: number | null): Promise<string | null> {
  const notes = reason.trim();
  if (!notes) return "Напишите причину — её увидит игрок";
  const request = await prisma.profileEditRequest.findUnique({ where: { id } });
  if (!request) return "Правка не найдена";
  if (request.status !== "pending") return "Эта правка уже разобрана";

  await prisma.profileEditRequest.update({
    where: { id },
    data: { status: "rejected", notes, reviewedAt: new Date(), reviewedById: reviewedById ?? null },
  });
  return null;
}
