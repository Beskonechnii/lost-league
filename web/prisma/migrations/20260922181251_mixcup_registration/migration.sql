-- CreateTable
CREATE TABLE "MixCupRegistration" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MixCupRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MixCupEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MixCupRegistration_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "UserAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MixCupRegistration_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "mixCupSourceEventId" INTEGER,
    CONSTRAINT "Player_mixCupSourceEventId_fkey" FOREIGN KEY ("mixCupSourceEventId") REFERENCES "MixCupEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Player" ("accountId", "achievements", "banner", "birthday", "city", "country", "createdAt", "dotabuffUrl", "id", "interviewUrl", "mmr", "nickname", "nicknameChangedAt", "orderNo", "phone", "photo", "rank", "rankAt", "rankPrev", "realName", "realSurname", "slug", "steamUrl", "stratzUrl", "tags", "telegram", "tp") SELECT "accountId", "achievements", "banner", "birthday", "city", "country", "createdAt", "dotabuffUrl", "id", "interviewUrl", "mmr", "nickname", "nicknameChangedAt", "orderNo", "phone", "photo", "rank", "rankAt", "rankPrev", "realName", "realSurname", "slug", "steamUrl", "stratzUrl", "tags", "telegram", "tp" FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
CREATE UNIQUE INDEX "Player_slug_key" ON "Player"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MixCupRegistration_eventId_accountId_key" ON "MixCupRegistration"("eventId", "accountId");
