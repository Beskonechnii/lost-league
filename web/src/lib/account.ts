// Только сервер: операции над аккаунтами игроков поверх сессии (lib/player-auth.ts) и БД.
// Одно место правды для «кто вошёл», «завести профиль», «подать/подтвердить заявку» — чтобы
// правила привязки не разъезжались между страницей /me и админкой.

import "server-only";
import { headers } from "next/headers";
import { prisma } from "./prisma";
import { currentAccountId, setSessionCookie } from "./player-session";
import type { Role } from "./player-auth";
import { slugify, normalizeTelegram, parseBirthday } from "./profiles";
import { hashPassword, verifyPassword, passwordProblem } from "./password";
import { clientIpFromHeaders, takeLoginAttempt, clearLoginAttempts } from "./rate-limit";
import { formatPermissions, hasPermission, permissionsOf, type PermissionKey } from "./permissions";
import { syncShards } from "./shards";
import {
  normalizeApplication,
  formatApplication,
  parseApplication,
  formatDraft,
  parseDraft,
  applicationLinkColumns,
  applicationAccountId,
  type Application,
  type ApplicationDraft,
  type ApplicationInput,
} from "./application";

/** Аккаунт по id — вместе с привязанным профилем и заявкой (обе связи опциональны). */
export function loadAccount(id: number) {
  return prisma.userAccount.findUnique({ where: { id }, include: { player: true, claim: true } });
}

export type Account = NonNullable<Awaited<ReturnType<typeof loadAccount>>>;

/** Текущий вошедший игрок, либо null. Читает куку запроса. */
export async function currentAccount(): Promise<Account | null> {
  const id = await currentAccountId();
  return id == null ? null : loadAccount(id);
}

// ── роли и владелец ───────────────────────────────────────────────────────────
//
// Владелец — не роль в БД, а адрес из OWNER_EMAIL: совпал email при входе → owner, и отобрать это
// из UI нельзя (иначе владелец мог бы случайно разжаловать сам себя и потерять доступ). Роль в БД
// хранит только admin/player, которые раздаёт владелец. Эффективная роль = owner по почте ИЛИ то,
// что записано. Это одно место правды — им пользуются и вход (какую роль вшить в куку), и панель.

/**
 * Адреса владельцев из `OWNER_EMAIL`: одна почта или несколько через запятую. Список, а не одна
 * строка, потому что у одного человека бывает два входа (рабочая почта и Google), и заводить ради
 * второго админа с ручной галочкой каждого права — значит держать две правды об одних и тех же
 * полномочиях. Владельцев по-прежнему назначает только `.env`, из UI список не правится.
 */
export function ownerEmails(): string[] {
  return (process.env.OWNER_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Почты может не быть вовсе (аккаунт из бота) — тогда это точно не владелец. */
export function isOwnerEmail(email: string | null | undefined): boolean {
  const mail = (email ?? "").trim().toLowerCase();
  return mail.length > 0 && ownerEmails().includes(mail);
}

/** Роль, с которой аккаунт реально ходит по сайту: owner по почте перекрывает запись в БД. */
export function effectiveRole(account: { email: string | null; role: string }): Role {
  if (isOwnerEmail(account.email)) return "owner";
  return account.role === "admin" ? "admin" : "player";
}

/** Текущая роль запроса (owner/admin/player), либо null если не вошёл. */
export async function currentRole(): Promise<Role | null> {
  const acc = await currentAccount();
  return acc ? effectiveRole(acc) : null;
}

// ── воронка регистрации ───────────────────────────────────────────────────────
//
// Регистрация — это заявка, а не пропуск: вошёл → draft (анкеты нет) → pending (анкета отправлена)
// → active (одобрен) либо rejected (отказ с причиной, анкету можно поправить и отправить снова).
// Сам Player заводится только при апруве — иначе неодобренный сразу попал бы в публичный ростер
// (витрины читают Player без фильтров). Владелец вне воронки: он всегда active, иначе, зачистив
// базу, он запер бы сам себя — апрувить его было бы некому.

export type AccountStatus = "draft" | "pending" | "active" | "rejected";

const STATUSES: AccountStatus[] = ["draft", "pending", "active", "rejected"];

/** Статус, с которым аккаунт реально живёт: у владельца по OWNER_EMAIL всегда active. */
export function accountStatus(account: { email: string | null; status: string }): AccountStatus {
  if (isOwnerEmail(account.email)) return "active";
  return STATUSES.includes(account.status as AccountStatus) ? (account.status as AccountStatus) : "draft";
}

/** Одобрен ли аккаунт (прошёл модерацию). */
export const isActiveAccount = (account: { email: string | null; status: string }) => accountStatus(account) === "active";

// ── гранулярные права ─────────────────────────────────────────────────────────
//
// Реестр прав — чистый permissions.ts, а гарды здесь: они читают БД. Роль вшита в подписанную куку и
// обновляется лишь при следующем входе, для прав это неприемлемо — снял право, оно обязано пропасть
// сразу. Служебная часть не горячий путь, лишний запрос там дешевле дырки в доступе.

/** Права вошедшего: пусто, если не вошёл. */
export async function currentPermissions(): Promise<PermissionKey[]> {
  const acc = await currentAccount();
  return acc ? permissionsOf(effectiveRole(acc), acc.permissions) : [];
}

/** Есть ли у вошедшего право — для «показывать ли плитку/подвкладку». Не бросает. */
export async function can(key: PermissionKey): Promise<boolean> {
  const acc = await currentAccount();
  return !!acc && hasPermission(effectiveRole(acc), acc.permissions, key);
}

/** Гард страницы/экшена/роута: вернуть аккаунт с правом или бросить. Гейт в роуте обязателен —
 *  страницу можно и не открывать, дойдя до API напрямую. */
export async function requirePermission(key: PermissionKey): Promise<Account> {
  const acc = await currentAccount();
  if (!acc || !hasPermission(effectiveRole(acc), acc.permissions, key)) {
    throw new Error("Недостаточно прав");
  }
  return acc;
}

/** Свободный slug на основе ника: `nick`, `nick-2`, `nick-3`… — slug уникален у Player. */
async function uniqueSlug(base: string): Promise<string> {
  const root = base || "player";
  let slug = root;
  for (let n = 2; await prisma.player.findUnique({ where: { slug }, select: { id: true } }); n++) {
    slug = `${root}-${n}`;
  }
  return slug;
}

// Функции «завести Player по одному нику» здесь больше нет (Э18). Она была вторым входом в лигу:
// аккаунт без профиля создавал себе игрока одной строкой, минуя анкету и модерацию, — и в ростере
// появлялся человек, о котором лига не знала ничего, кроме ника. Player заводится ровно в одном
// месте — при апруве заявки (`createPlayerFromApplication`).

// ── правка своей анкеты игроком (self-service) ─────────────────────────────────
//
// Игрок правит только СВОИ анкетные поля. То, что принадлежит лиге (MMR, роль в составе, TP,
// номер, фото/баннер), редактирует лишь оператор в /admin — здесь этих полей нет намеренно.
// slug не трогаем никогда (см. schema): от него зависят файлы картинок, поэтому меняется ник,
// а адрес ассета — нет.

// Лимит смены ника — общее правило обоих входов, кабинета и бота, поэтому живёт в profile-edit.ts:
// сюда `server-only`, а тот модуль зовёт ещё и бот (обычный node). Двух правил «раз в сезон» быть
// не должно — иначе бот и сайт однажды разойдутся в том, когда можно снова.

/** Поля анкеты, которые игрок пишет В ПРОФИЛЬ сразу. Ник, город, ссылка и MMR сюда не входят:
 *  они идут заявкой в очередь модерации — то же правило, что и у бота (`profile-edit.ts`). */
export type OwnProfileInput = {
  realName?: string;
  country?: string;
  birthday?: string;
  telegram?: string;
};

/** Записать правки анкеты от имени вошедшего игрока. Возвращает ошибку строкой или null при успехе. */
export async function updateOwnProfile(accountId: number, input: OwnProfileInput): Promise<string | null> {
  const account = await prisma.userAccount.findUnique({ where: { id: accountId }, select: { playerId: true } });
  if (!account?.playerId) return "Профиль не привязан";
  const data: Record<string, unknown> = {};

  // Простые текстовые поля: пусто → null (дыр в анкете быть не должно).
  const setText = (key: keyof OwnProfileInput, column: string) => {
    if (input[key] !== undefined) data[column] = (input[key] as string).trim() || null;
  };
  setText("realName", "realName");
  setText("country", "country");

  if (input.telegram !== undefined) {
    const raw = input.telegram.trim();
    if (raw === "") data.telegram = null;
    else {
      const handle = normalizeTelegram(raw);
      if (!handle) return `«${raw}» не похоже на телеграм-хендл`;
      data.telegram = handle;
    }
  }

  if (input.birthday !== undefined) {
    const raw = input.birthday.trim();
    if (raw === "") data.birthday = null;
    else {
      const date = parseBirthday(raw);
      if (!date) return `Дата «${raw}» не разобрана — ждём 21.04.1998`;
      data.birthday = date;
    }
  }

  if (Object.keys(data).length > 0) {
    await prisma.player.update({ where: { id: account.playerId }, data });
    // Правка анкеты могла закрыть последнюю дыру — а это веха «анкета заполнена» (lib/shards.ts).
    await syncShards(accountId);
  }
  return null;
}

/** Заявка на существующего игрока — ждёт подтверждения оператора. Занятого игрока заявить нельзя. */
export async function claimExisting(accountId: number, playerId: number): Promise<void> {
  const taken = await prisma.userAccount.findUnique({ where: { playerId }, select: { id: true } });
  if (taken) throw new Error("Этот игрок уже привязан к другому аккаунту");
  const exists = await prisma.player.findUnique({ where: { id: playerId }, select: { id: true } });
  if (!exists) throw new Error("Игрок не найден");
  await prisma.userAccount.update({ where: { id: accountId }, data: { claimId: playerId } });
}

/** Игроки, к которым ещё можно привязаться, — не занятые чьей-то подтверждённой привязкой. */
export async function linkablePlayers() {
  const linked = await prisma.userAccount.findMany({
    where: { playerId: { not: null } },
    select: { playerId: true },
  });
  const taken = new Set(linked.map((l) => l.playerId!));
  const players = await prisma.player.findMany({
    orderBy: { nickname: "asc" },
    // Расширенный набор полей — чтобы анкета «Я уже участник лиги» подтягивала уже известное
    // о найденном игроке и просила заполнить только то, чего в ростере ещё нет.
    select: {
      id: true,
      nickname: true,
      slug: true,
      realName: true,
      realSurname: true,
      telegram: true,
      city: true,
      country: true,
      birthday: true,
      mmr: true,
      phone: true,
      dotabuffUrl: true,
      stratzUrl: true,
      steamUrl: true,
    },
  });
  return players.filter((p) => !taken.has(p.id));
}

// ── анкета-заявка на вступление ───────────────────────────────────────────────
//
// Что происходит при регистрации: аккаунт заводится в draft, и до отправки анкеты кабинет ничего,
// кроме неё, не показывает — иначе в очередь модерации попадали бы пустые аккаунты (требование 6).
// Обе ветки — «я новый игрок» (анкета JSON) и «я уже в ростере» (заявка на привязку) — заканчиваются
// в pending; какая именно, оператор увидит по наличию application / claimId.
//
// Согласие с политикой (/rules) — обязательное условие отправки, поэтому проверяется здесь, а не
// только в форме: до БД можно дойти и мимо неё.

/** Анкета аккаунта, разобранная из JSON; её ещё нет — null. */
export const accountApplication = (account: { application: string | null }): Application | null =>
  parseApplication(account.application);

/** Незаконченный квиз аккаунта; его нет или он от старой версии формы — null. */
export const accountApplicationDraft = (account: { applicationDraft: string | null }): ApplicationDraft | null =>
  parseDraft(account.applicationDraft);

/** Сохранить черновик анкеты. Без проверок и без revalidate: это незаконченный ввод, а не заявка,
 *  и на разметку страницы он не влияет — форма уже держит эти значения у себя. */
export async function storeApplicationDraft(accountId: number, draft: ApplicationDraft): Promise<void> {
  await prisma.userAccount.update({
    where: { id: accountId },
    data: { applicationDraft: formatDraft(draft) },
  });
}

const POLICY_REQUIRED = "Примите правила лиги — без согласия заявку не отправить";

/** Отправить анкету нового игрока: проверяем, пишем JSON и переводим аккаунт в pending.
 *  Возвращает текст ошибки или null при успехе (как updateOwnProfile). */
export async function submitApplication(
  accountId: number,
  input: ApplicationInput,
  policyAccepted: boolean,
): Promise<string | null> {
  if (!policyAccepted) return POLICY_REQUIRED;
  const parsed = normalizeApplication(input);
  if (!parsed.ok) return parsed.error;

  const now = new Date();
  await prisma.userAccount.update({
    where: { id: accountId },
    data: {
      application: formatApplication(parsed.value),
      applicationDraft: null, // отправленное живёт в application; черновику здесь больше нечего хранить
      claimId: null, // ветка «я новый игрок» отменяет ранее выбранную привязку
      policyAcceptedAt: now,
      submittedAt: now,
      status: "pending",
      // Прошлый отказ снимаем: человек прислал новую редакцию, старая причина к ней не относится.
      rejectedReason: null,
      reviewedAt: null,
      reviewedById: null,
    },
  });
  return null;
}

/**
 * Привязка к найденному в ростере профилю, но с анкетой рядом: экран «Я уже участник лиги»
 * подтягивает в квиз то, что в Player уже есть, а чего не хватает — доспрашивает у игрока.
 * Данные из формы дополняют профиль (только пустые поля — свою правку операторской карточки
 * самозаполнение не перетирает), а сама привязка ждёт подтверждения как обычный claim.
 */
export async function submitClaimWithApplication(
  accountId: number,
  playerId: number,
  input: ApplicationInput,
  policyAccepted: boolean,
): Promise<string | null> {
  if (!policyAccepted) return POLICY_REQUIRED;
  const parsed = normalizeApplication(input);
  if (!parsed.ok) return parsed.error;

  try {
    await claimExisting(accountId, playerId);
  } catch (e) {
    return e instanceof Error ? e.message : "Не удалось подать заявку";
  }

  const app = parsed.value;
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (player) {
    const fill: Record<string, unknown> = {};
    if (!player.realName && app.realName) fill.realName = app.realName;
    if (!player.realSurname && app.realSurname) fill.realSurname = app.realSurname;
    if (!player.telegram && app.telegram) fill.telegram = app.telegram;
    if (!player.phone && app.phone) fill.phone = app.phone;
    if (!player.city && app.city) fill.city = app.city;
    if (!player.country && app.country) fill.country = app.country;
    if (!player.birthday && app.birthday) fill.birthday = parseBirthday(app.birthday);
    if (!player.mmr && app.mmr != null) fill.mmr = app.mmr;
    if (!player.accountId) {
      const accId = applicationAccountId(app);
      if (accId) fill.accountId = accId;
    }
    for (const [column, value] of Object.entries(applicationLinkColumns(app))) {
      if (value && !(player as Record<string, unknown>)[column]) fill[column] = value;
    }
    if (Object.keys(fill).length > 0) {
      await prisma.player.update({ where: { id: playerId }, data: fill });
    }
  }

  const now = new Date();
  await prisma.userAccount.update({
    where: { id: accountId },
    data: {
      application: null, // привязка к готовому профилю анкеты не требует — данные уже в Player
      applicationDraft: null, // квиз пройден: черновик своё отработал
      policyAcceptedAt: now,
      submittedAt: now,
      status: "pending",
      rejectedReason: null,
      reviewedAt: null,
      reviewedById: null,
    },
  });
  return null;
}

// ── операторская модерация заявок ────────────────────────────────────────────

/** Заявки на привязку, ждущие решения: есть claim, но привязки ещё нет. Отбираем **по виду заявки**,
 *  а не по статусу аккаунта: оператор ищет привязку на своей вкладке, и раньше она уезжала в очередь
 *  анкет только потому, что аккаунт был в pending. Статус решает не место в списке, а последствия
 *  решения (см. rejectClaim). */
export function pendingClaims() {
  return prisma.userAccount.findMany({
    where: { claimId: { not: null }, playerId: null },
    include: { claim: true },
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
  });
}

export type PendingClaim = Awaited<ReturnType<typeof pendingClaims>>[number];

/** Оператор отклонил привязку. Аккаунт из воронки регистрации уходит в `rejected` с причиной —
 *  иначе он навсегда завис бы в `pending` без профиля и без объяснения; уже открытому аккаунту
 *  просто снимаем заявку: его самого никто не выгонял, привязку он подаст заново. */
export async function rejectClaim(accountId: number, reason: string): Promise<string | null> {
  const reviewer = await requirePermission("accounts.approve");
  const account = await prisma.userAccount.findUnique({ where: { id: accountId }, select: { status: true } });
  if (!account) return "Аккаунт не найден";
  if (account.status === "pending") return rejectRegistration(accountId, reason);
  await prisma.userAccount.update({
    where: { id: accountId },
    data: { claimId: null, reviewedAt: new Date(), reviewedById: reviewer.id },
  });
  return null;
}

/** Очередь анкет: отправленные заявки нового игрока, ранние сверху — их разбирают по порядку.
 *  Привязки сюда не попадают: у них своя вкладка (pendingClaims). */
export function pendingRegistrations() {
  return prisma.userAccount.findMany({
    where: { status: "pending", claimId: null },
    include: { claim: true, player: true },
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
  });
}

export type PendingRegistration = Awaited<ReturnType<typeof pendingRegistrations>>[number];

/** Анкета → новый Player. MMR берём не из анкеты: там он со слов игрока, а в лиге это её собственные
 *  данные — их ставит оператор в форме апрува. Позиции у Player нет вовсе: роль в составе живёт в
 *  RosterSpot и появляется вместе с командой, поэтому заявленная позиция остаётся в анкете. */
async function createPlayerFromApplication(app: Application, mmr: number | null): Promise<number> {
  const slug = await uniqueSlug(slugify(app.nickname));
  const player = await prisma.player.create({
    data: {
      slug,
      nickname: app.nickname,
      realName: app.realName || null,
      realSurname: app.realSurname || null,
      birthday: app.birthday ? parseBirthday(app.birthday) : null,
      city: app.city || null,
      country: app.country || null,
      ...applicationLinkColumns(app),
      telegram: app.telegram || null,
      phone: app.phone || null,
      // Без account_id игрок не находится ни в одном матче (§7 CLAUDE.md) — выводим из ссылок сразу.
      accountId: applicationAccountId(app),
      mmr,
    },
  });
  return player.id;
}

export type ApproveResult = { ok: true; playerId: number } | { ok: false; error: string };

/** Одобрить заявку: завести профиль из анкеты либо подтвердить привязку, и открыть аккаунт. */
export async function approveRegistration(accountId: number, mmr: number | null): Promise<ApproveResult> {
  const reviewer = await requirePermission("accounts.approve");
  const account = await prisma.userAccount.findUnique({ where: { id: accountId } });
  if (!account) return { ok: false, error: "Аккаунт не найден" };

  let playerId = account.playerId;
  if (playerId == null) {
    if (account.claimId != null) {
      // Привязка: профиль уже есть. Пока заявка ждала, игрока мог занять другой аккаунт.
      const taken = await prisma.userAccount.findUnique({ where: { playerId: account.claimId }, select: { id: true } });
      if (taken && taken.id !== accountId) return { ok: false, error: "Игрок уже привязан к другому аккаунту" };
      playerId = account.claimId;
    } else {
      const app = parseApplication(account.application);
      if (!app) return { ok: false, error: "У заявки нет ни анкеты, ни выбранного профиля — верните её с причиной" };
      playerId = await createPlayerFromApplication(app, mmr);
    }
  }

  await prisma.userAccount.update({
    where: { id: accountId },
    data: {
      playerId,
      claimId: null,
      status: "active",
      reviewedAt: new Date(),
      reviewedById: reviewer.id,
      rejectedReason: null, // решение принято, прошлая причина отказа к нему не относится
    },
  });
  // Осколки начисляются ЗДЕСЬ, а не в экшене админки: путей одобрения два (анкета и привязка), и
  // оба идут сюда — правило «после апрува» не должно зависеть от того, какую кнопку нажали.
  await syncShards(accountId);
  return { ok: true, playerId };
}

/** Вернуть заявку с причиной: человек видит её в кабинете, правит анкету и отправляет снова.
 *  Возвращает текст ошибки или null при успехе. */
export async function rejectRegistration(accountId: number, reason: string): Promise<string | null> {
  const text = reason.trim();
  if (!text) return "Напишите причину — человек увидит её в кабинете и по ней поправит анкету";
  const reviewer = await requirePermission("accounts.approve");
  await prisma.userAccount.update({
    where: { id: accountId },
    data: {
      status: "rejected",
      rejectedReason: text,
      reviewedAt: new Date(),
      reviewedById: reviewer.id,
      // Выбранный профиль снимаем: решение принято, иначе отклонённая привязка так и висела бы
      // открытой в очереди /admin/claims.
      claimId: null,
    },
  });
  return null;
}

// ── панель команды лиги (/admin/staff) ────────────────────────────────────────
//
// Раздача ролей и прав. Раньше это была панель только для владельца (requireOwner); теперь право
// на неё — обычный ключ реестра (accounts.admins), у владельца он есть всегда. Так владелец может
// разгрузить себя, не отдавая никому OWNER_EMAIL.
//
// Свой аккаунт из панели не правится намеренно: иначе админ снял бы себе роль и запер сам себя,
// а «выдать себе всё» превратилось бы в один клик. Своё меняет только тот, у кого право есть выше.

/** Все аккаунты для панели: профиль/заявка, эффективная роль и её права. */
export async function listAccounts() {
  const rows = await prisma.userAccount.findMany({
    include: { player: true, claim: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((a) => {
    const role = effectiveRole(a);
    return { ...a, effectiveRole: role, perms: permissionsOf(role, a.permissions) };
  });
}

export type StaffAccount = Awaited<ReturnType<typeof listAccounts>>[number];

/** Кого вообще можно трогать в панели: не владелец (его роль задаёт OWNER_EMAIL) и не ты сам. */
async function editableTarget(targetId: number) {
  const actor = await requirePermission("accounts.admins");
  if (actor.id === targetId) throw new Error("Свою роль и права здесь не меняют — попросите владельца лиги");
  const target = await prisma.userAccount.findUnique({ where: { id: targetId }, select: { email: true, role: true } });
  if (!target) throw new Error("Аккаунт не найден");
  if (isOwnerEmail(target.email)) throw new Error("Владелец задаётся через OWNER_EMAIL — его роль и права неотчуждаемы");
  return target;
}

/** Назначить админом или снять. Снятие гасит права: вернув роль, админ начинает с нуля — иначе
 *  снятый и возвращённый человек молча получил бы обратно весь прежний набор. */
export async function setAccountRole(targetId: number, role: "admin" | "player"): Promise<void> {
  await editableTarget(targetId);
  await prisma.userAccount.update({
    where: { id: targetId },
    data: role === "admin" ? { role } : { role, permissions: null },
  });
}

/** Выдать админу набор прав (чекбоксы в панели). Неизвестные ключи отсекает formatPermissions. */
export async function setAccountPermissions(targetId: number, keys: string[]): Promise<void> {
  const target = await editableTarget(targetId);
  if (target.role !== "admin") throw new Error("Права выдаются админам — сначала назначьте роль");
  await prisma.userAccount.update({ where: { id: targetId }, data: { permissions: formatPermissions(keys) } });
}

// ── вход по email + паролю ─────────────────────────────────────────────────────
//
// Второй способ входа рядом с Google. Ключ аккаунта — email (уникален): один человек ↔ один аккаунт,
// хоть Google, хоть пароль, хоть оба. Правила безопасности:
//   • регистрация НЕ трогает уже существующий email — иначе, зная чужую почту, можно было бы
//     подсадить свой пароль в чужой Google-аккаунт (перехват).
//   • писем нет вообще (почтовый флоу убран), поэтому подтверждение почты не гейт входа: вход по
//     паролю открыт сразу, а `emailVerified` поднимает только Google. Пускать внутрь не страшно —
//     новый аккаунт всё равно попадает в воронку (draft) и до апрува ничего в лиге не значит.
//   • «забыли пароль» из-за этого не работает: пути обхода — вход через Google той же почтой либо
//     удаление аккаунта и повторная регистрация (см. docs/archive/ACCOUNTS-PLAN.md §2.4).

/** Выдать сессию аккаунту с правильной ролью: владельца по OWNER_EMAIL закрепляем в БД (как в OAuth):
 *  роль owner и статус active — он вне воронки, апрувить его некому. */
/** `remember` — «Запомнить меня» с формы: без него кука входа живёт до закрытия браузера,
 *  хотя сама сессия внутри действительна 30 дней (TTL_MS) — с флагом кука переживает и закрытие. */
export async function establishSession(accountId: number, remember = false): Promise<void> {
  const account = await prisma.userAccount.findUnique({ where: { id: accountId } });
  if (!account) return;
  if (isOwnerEmail(account.email) && (account.role !== "owner" || account.status !== "active")) {
    await prisma.userAccount.update({ where: { id: account.id }, data: { role: "owner", status: "active" } });
  }
  await setSessionCookie(account.id, effectiveRole(account), remember);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Нормализованный (нижний регистр, без пробелов) email — им всегда ищем и пишем. */
const normEmail = (email: string) => email.trim().toLowerCase();

/** Претензии к формату почты, либо null. */
export function emailProblem(email: string): string | null {
  return EMAIL_RE.test(normEmail(email)) ? null : "Введите корректный email";
}

export type RegisterResult = { ok: true; accountId: number } | { ok: false; error: string };

/** Регистрация по email + паролю. Заводит аккаунт в статусе draft (дефолт схемы) и отдаёт его id —
 *  сессию выдаёт вызывающий, а дальше кабинет требует анкету. Писем не шлём: почтового флоу нет.
 *  Имени не спрашиваем: его всё равно спросит анкета, а лишнее поле на входе только удлиняет форму
 *  (Account.name остаётся — его заполняет Google-вход). */
export async function registerWithPassword(email: string, password: string): Promise<RegisterResult> {
  const mail = normEmail(email);
  const ep = emailProblem(mail);
  if (ep) return { ok: false, error: ep };
  // Контекст правил — почта: пароль, повторяющий её, знакомый подберёт с первого раза.
  const pp = passwordProblem(password, { email: mail });
  if (pp) return { ok: false, error: pp };

  const existing = await prisma.userAccount.findUnique({ where: { email: mail }, select: { id: true } });
  if (existing) return { ok: false, error: "Почта уже занята — войдите под ней." };

  const account = await prisma.userAccount.create({
    data: { email: mail, passwordHash: hashPassword(password) },
  });
  return { ok: true, accountId: account.id };
}

export type LoginResult = { ok: true; accountId: number } | { ok: false; error: string };

/**
 * Вход по email + паролю. Возвращает id аккаунта для выдачи сессии, либо ошибку.
 *
 * Здесь же лимит попыток — на сервере, а не в форме: форму обходит любой curl, а перебор пароля
 * ровно этим и занимается. Слот занимаем ДО проверки, чтобы считались и промахи по несуществующей
 * почте, а успех окно сбрасывает — считать надо неудачи, а не входы живого человека.
 *
 * Правила `passwordProblem` тут НЕ применяются намеренно: часть паролей заведена по старым
 * требованиям (минимум был 8), и ужесточение не должно запирать этих людей снаружи. Новые правила
 * работают при заведении и смене пароля.
 */
export async function loginWithPassword(email: string, password: string): Promise<LoginResult> {
  const mail = normEmail(email);
  const ip = clientIpFromHeaders(await headers());

  const slot = takeLoginAttempt(mail, ip);
  if (!slot.ok) {
    const minutes = Math.max(1, Math.ceil(slot.retryAfterSec / 60));
    return { ok: false, error: `Слишком много попыток входа. Попробуйте через ${minutes} мин.` };
  }

  const account = await prisma.userAccount.findUnique({ where: { email: mail } });
  // Одинаковый текст на «нет такого аккаунта» и «пароль не тот» — не подсказываем, что почта есть.
  if (!account || !verifyPassword(password, account.passwordHash)) {
    return { ok: false, error: "Неверная почта или пароль" };
  }
  clearLoginAttempts(mail, ip);
  return { ok: true, accountId: account.id };
}

// ── управление своим входом из кабинета (уже вошедший игрок) ────────────────────

/** Сменить (или задать впервые) пароль из кабинета. Текущий пароль спрашиваем, только если он есть —
 *  у входившего лишь через Google его нет, а владение аккаунтом уже доказано активной сессией. */
export async function changePassword(
  accountId: number,
  current: string,
  next: string,
): Promise<string | null> {
  const account = await prisma.userAccount.findUnique({
    where: { id: accountId },
    // Почта и ник — контекст правил: новый пароль не должен их повторять.
    select: { passwordHash: true, email: true, player: { select: { nickname: true } } },
  });
  if (!account) return "Сессия истекла — войдите снова";
  // Пароль уже задан → без верного текущего менять нельзя (защита от смены по угнанной сессии).
  if (account.passwordHash && !verifyPassword(current, account.passwordHash)) {
    return "Текущий пароль неверен";
  }
  const pp = passwordProblem(next, {
    email: account.email ?? undefined,
    nickname: account.player?.nickname,
  });
  if (pp) return pp;
  await prisma.userAccount.update({ where: { id: accountId }, data: { passwordHash: hashPassword(next) } });
  return null;
}

/** Удалить свой аккаунт. Профиль игрока (Player) и его турнирная история остаются — рвётся только вход
 *  (Player.account через onDelete: SetNull). Q4 концепта. */
export async function deleteOwnAccount(accountId: number): Promise<void> {
  await prisma.userAccount.delete({ where: { id: accountId } });
}

/** Удалить чужой аккаунт входа — только владелец лиги. Отдельная (более узкая, чем accounts.admins)
 *  проверка: право на панель команды можно выдать и админу, а необратимо стирать чужой вход (пароль,
 *  привязку tg/Google) — только тому, кого нельзя разжаловать самого. Профиль игрока (Player) не трогаем,
 *  как и в deleteOwnAccount — рвётся только вход. */
export async function deleteAccount(targetId: number): Promise<void> {
  const actor = await currentAccount();
  if (!actor || effectiveRole(actor) !== "owner") throw new Error("Удалять аккаунты может только владелец лиги");
  if (actor.id === targetId) throw new Error("Свой аккаунт удаляется из кабинета, а не отсюда");
  const target = await prisma.userAccount.findUnique({ where: { id: targetId }, select: { email: true } });
  if (!target) throw new Error("Аккаунт не найден");
  if (isOwnerEmail(target.email)) throw new Error("Владелец задаётся через OWNER_EMAIL — удалить этот аккаунт нельзя");
  await prisma.userAccount.delete({ where: { id: targetId } });
}
