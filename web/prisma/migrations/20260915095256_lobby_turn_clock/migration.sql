-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lobby" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'gather',
    "sideATeamId" INTEGER NOT NULL,
    "sideBTeamId" INTEGER NOT NULL,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lobby_sideATeamId_fkey" FOREIGN KEY ("sideATeamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lobby_sideBTeamId_fkey" FOREIGN KEY ("sideBTeamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lobby_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Lobby" ("bestOf", "coinBlock", "coinWinner", "createdAt", "firstPick", "id", "mainSec", "ownerAccountId", "payload", "radiant", "reserveSec", "seriesId", "sideATeamId", "sideBTeamId", "status", "title", "updatedAt") SELECT "bestOf", "coinBlock", "coinWinner", "createdAt", "firstPick", "id", "mainSec", "ownerAccountId", "payload", "radiant", "reserveSec", "seriesId", "sideATeamId", "sideBTeamId", "status", "title", "updatedAt" FROM "Lobby";
DROP TABLE "Lobby";
ALTER TABLE "new_Lobby" RENAME TO "Lobby";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Комнаты, уже открывшие драфт до 22б, начинают считать часы с полным банком: нулевой банк
-- означал бы, что у обеих сторон доп-время кончилось, ещё не начавшись.
UPDATE "Lobby" SET "reserveA" = "reserveSec", "reserveB" = "reserveSec" WHERE "status" = 'draft';
