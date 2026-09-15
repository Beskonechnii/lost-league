/*
  Warnings:

  - Added the required column `obsKey` to the `Lobby` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "LobbyMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lobbyId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LobbyMessage_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "obsKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lobby_sideATeamId_fkey" FOREIGN KEY ("sideATeamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lobby_sideBTeamId_fkey" FOREIGN KEY ("sideBTeamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lobby_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Lobby" ("autoFrom", "bestOf", "coinBlock", "coinWinner", "createdAt", "firstPick", "id", "mainSec", "ownerAccountId", "payload", "radiant", "reserveA", "reserveB", "reserveSec", "seriesId", "sideATeamId", "sideBTeamId", "status", "title", "turnStartedAt", "updatedAt") SELECT "autoFrom", "bestOf", "coinBlock", "coinWinner", "createdAt", "firstPick", "id", "mainSec", "ownerAccountId", "payload", "radiant", "reserveA", "reserveB", "reserveSec", "seriesId", "sideATeamId", "sideBTeamId", "status", "title", "turnStartedAt", "updatedAt" FROM "Lobby";
DROP TABLE "Lobby";
ALTER TABLE "new_Lobby" RENAME TO "Lobby";
CREATE UNIQUE INDEX "Lobby_obsKey_key" ON "Lobby"("obsKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "LobbyMessage_lobbyId_id_idx" ON "LobbyMessage"("lobbyId", "id");
