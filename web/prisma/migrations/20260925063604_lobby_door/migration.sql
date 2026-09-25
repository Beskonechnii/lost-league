-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lobby" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'gather',
    "sideAName" TEXT NOT NULL DEFAULT 'Сторона A',
    "sideBName" TEXT NOT NULL DEFAULT 'Сторона B',
    "sideATeamId" INTEGER,
    "sideBTeamId" INTEGER,
    "password" TEXT NOT NULL DEFAULT '',
    "mainSec" INTEGER NOT NULL,
    "reserveSec" INTEGER NOT NULL,
    "bestOf" INTEGER NOT NULL DEFAULT 3,
    "seriesId" INTEGER,
    "ownerAccountId" INTEGER NOT NULL,
    "coinWinner" INTEGER,
    "coinBlock" TEXT,
    "firstPick" INTEGER,
    "radiant" INTEGER,
    "payload" TEXT NOT NULL DEFAULT '',
    "turnStartedAt" DATETIME,
    "reserveA" INTEGER NOT NULL DEFAULT 0,
    "reserveB" INTEGER NOT NULL DEFAULT 0,
    "autoFrom" INTEGER,
    "obsKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lobby_sideATeamId_fkey" FOREIGN KEY ("sideATeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lobby_sideBTeamId_fkey" FOREIGN KEY ("sideBTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lobby_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
-- Имена сторон уже заведённых комнат берём из связанных команд: комната, собранная до 42б,
-- обязана открыться с теми же именами, что показывала вчера. Команду удалили (привязка была
-- NOT NULL, так что строки без неё нет) — остаётся дефолт колонки.
INSERT INTO "new_Lobby" ("autoFrom", "bestOf", "coinBlock", "coinWinner", "createdAt", "firstPick", "id", "mainSec", "obsKey", "ownerAccountId", "password", "payload", "radiant", "reserveA", "reserveB", "reserveSec", "seriesId", "sideAName", "sideATeamId", "sideBName", "sideBTeamId", "status", "title", "turnStartedAt", "updatedAt") SELECT "autoFrom", "bestOf", "coinBlock", "coinWinner", "createdAt", "firstPick", "id", "mainSec", "obsKey", "ownerAccountId", '', "payload", "radiant", "reserveA", "reserveB", "reserveSec", "seriesId", COALESCE((SELECT "name" FROM "Team" WHERE "Team"."id" = "Lobby"."sideATeamId"), 'Сторона A'), "sideATeamId", COALESCE((SELECT "name" FROM "Team" WHERE "Team"."id" = "Lobby"."sideBTeamId"), 'Сторона B'), "sideBTeamId", "status", "title", "turnStartedAt", "updatedAt" FROM "Lobby";
DROP TABLE "Lobby";
ALTER TABLE "new_Lobby" RENAME TO "Lobby";
CREATE UNIQUE INDEX "Lobby_obsKey_key" ON "Lobby"("obsKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
