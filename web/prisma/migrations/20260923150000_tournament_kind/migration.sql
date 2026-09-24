-- ТЗ 37: турнир получает формат. MixCupEvent исчезает как модель — его строки переезжают в
-- Tournament (kind = 'mixcup') вместе со спутниками. Перенос данных живёт прямо здесь, а не
-- отдельным скриптом: исходную таблицу сносит эта же миграция, и запустить скрипт после неё
-- было бы уже неоткуда, а до неё — не к чему (колонок-приёмников ещё нет).
--
-- Статусы: своего словаря у формата больше нет, open/closed/done читаются общим словарём
-- турнира — open → registration (приём идёт), closed → running (приём закрыт, эфир впереди),
-- done → finished.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- ── 1. Tournament: новое поле kind ───────────────────────────────────────────
CREATE TABLE "new_Tournament" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short" TEXT,
    "description" TEXT,
    "format" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'season',
    "prize" TEXT,
    "logo" TEXT,
    "banner" TEXT,
    "matchesUrl" TEXT,
    "leagueId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "series" TEXT,
    "startAt" DATETIME,
    "endAt" DATETIME,
    "regOpenAt" DATETIME,
    "regCloseAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Tournament" ("banner", "createdAt", "description", "endAt", "format", "id", "leagueId", "logo", "matchesUrl", "name", "prize", "regCloseAt", "regOpenAt", "series", "short", "slug", "startAt", "status") SELECT "banner", "createdAt", "description", "endAt", "format", "id", "leagueId", "logo", "matchesUrl", "name", "prize", "regCloseAt", "regOpenAt", "series", "short", "slug", "startAt", "status" FROM "Tournament";
DROP TABLE "Tournament";
ALTER TABLE "new_Tournament" RENAME TO "Tournament";
CREATE UNIQUE INDEX "Tournament_slug_key" ON "Tournament"("slug");

-- ── 2. События Mix Cup становятся турнирами ──────────────────────────────────
INSERT INTO "Tournament" ("slug", "name", "kind", "status", "startAt", "createdAt")
SELECT
  "slug",
  COALESCE("title", 'Mix Cup #' || "id"),
  'mixcup',
  CASE "status" WHEN 'open' THEN 'registration' WHEN 'closed' THEN 'running' WHEN 'done' THEN 'finished' ELSE 'draft' END,
  "playedAt",
  "createdAt"
FROM "MixCupEvent";

-- ── 3. Тумблеры правил и рабочий стол — в спутник ────────────────────────────
CREATE TABLE "TournamentDraftSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tournamentId" INTEGER NOT NULL,
    "stealEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lockEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "draftSessionId" INTEGER,
    CONSTRAINT "TournamentDraftSettings_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TournamentDraftSettings_draftSessionId_fkey" FOREIGN KEY ("draftSessionId") REFERENCES "DraftSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TournamentDraftSettings_tournamentId_key" ON "TournamentDraftSettings"("tournamentId");
CREATE UNIQUE INDEX "TournamentDraftSettings_draftSessionId_key" ON "TournamentDraftSettings"("draftSessionId");

INSERT INTO "TournamentDraftSettings" ("tournamentId", "stealEnabled", "lockEnabled", "draftSessionId", "createdAt", "updatedAt")
SELECT t."id", e."stealEnabled", e."lockEnabled", e."draftSessionId", e."createdAt", e."updatedAt"
FROM "MixCupEvent" e JOIN "Tournament" t ON t."slug" = e."slug";

-- ── 4. Записи игроков — общая таблица обоих индивидуальных форматов ──────────
CREATE TABLE "TournamentRegistration" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tournamentId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TournamentRegistration_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TournamentRegistration_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "UserAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TournamentRegistration_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TournamentRegistration_tournamentId_accountId_key" ON "TournamentRegistration"("tournamentId", "accountId");

INSERT INTO "TournamentRegistration" ("tournamentId", "accountId", "playerId", "createdAt")
SELECT t."id", r."accountId", r."playerId", r."createdAt"
FROM "MixCupRegistration" r
JOIN "MixCupEvent" e ON e."id" = r."eventId"
JOIN "Tournament" t ON t."slug" = e."slug";

-- ── 5. Сохранённый результат драфта перевешивается на турнир ─────────────────
CREATE TABLE "new_MixCupTeam" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tournamentId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "orderNo" INTEGER NOT NULL,
    CONSTRAINT "MixCupTeam_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MixCupTeam" ("id", "tournamentId", "name", "color", "orderNo")
SELECT m."id", t."id", m."name", m."color", m."orderNo"
FROM "MixCupTeam" m
JOIN "MixCupEvent" e ON e."id" = m."eventId"
JOIN "Tournament" t ON t."slug" = e."slug";
DROP TABLE "MixCupTeam";
ALTER TABLE "new_MixCupTeam" RENAME TO "MixCupTeam";

-- ── 6. Player: откуда пришёл профиль — теперь турнир, а не событие ───────────
CREATE TABLE "new_Player" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "nicknameChangedAt" DATETIME,
    "realName" TEXT,
    "realSurname" TEXT,
    "phone" TEXT,
    "accountId" TEXT,
    "mmr" INTEGER,
    "rank" INTEGER,
    "rankPrev" INTEGER,
    "rankAt" DATETIME,
    "tp" INTEGER NOT NULL DEFAULT 0,
    "photo" TEXT,
    "steamUrl" TEXT,
    "dotabuffUrl" TEXT,
    "stratzUrl" TEXT,
    "telegram" TEXT,
    "birthday" DATETIME,
    "city" TEXT,
    "country" TEXT,
    "banner" TEXT,
    "interviewUrl" TEXT,
    "orderNo" INTEGER,
    "achievements" TEXT,
    "tags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "sourceTournamentId" INTEGER,
    CONSTRAINT "Player_sourceTournamentId_fkey" FOREIGN KEY ("sourceTournamentId") REFERENCES "Tournament" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Player" ("accountId", "achievements", "banner", "birthday", "city", "country", "createdAt", "dotabuffUrl", "id", "interviewUrl", "mmr", "nickname", "nicknameChangedAt", "orderNo", "phone", "photo", "rank", "rankAt", "rankPrev", "realName", "realSurname", "slug", "steamUrl", "stratzUrl", "tags", "telegram", "tp", "verified", "sourceTournamentId")
SELECT p."accountId", p."achievements", p."banner", p."birthday", p."city", p."country", p."createdAt", p."dotabuffUrl", p."id", p."interviewUrl", p."mmr", p."nickname", p."nicknameChangedAt", p."orderNo", p."phone", p."photo", p."rank", p."rankAt", p."rankPrev", p."realName", p."realSurname", p."slug", p."steamUrl", p."stratzUrl", p."tags", p."telegram", p."tp", p."verified",
  (SELECT t."id" FROM "MixCupEvent" e JOIN "Tournament" t ON t."slug" = e."slug" WHERE e."id" = p."mixCupSourceEventId")
FROM "Player" p;
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
CREATE UNIQUE INDEX "Player_slug_key" ON "Player"("slug");

-- ── 7. Старые таблицы больше не нужны ────────────────────────────────────────
DROP INDEX "MixCupRegistration_eventId_accountId_key";
DROP TABLE "MixCupRegistration";
DROP INDEX "MixCupEvent_draftSessionId_key";
DROP INDEX "MixCupEvent_slug_key";
DROP TABLE "MixCupEvent";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
