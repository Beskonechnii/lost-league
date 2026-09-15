-- CreateTable
CREATE TABLE "Lobby" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lobby_sideATeamId_fkey" FOREIGN KEY ("sideATeamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lobby_sideBTeamId_fkey" FOREIGN KEY ("sideBTeamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lobby_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LobbyMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lobbyId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "playerId" INTEGER,
    "side" INTEGER,
    "role" TEXT NOT NULL DEFAULT 'player',
    "captain" BOOLEAN NOT NULL DEFAULT false,
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" DATETIME,
    CONSTRAINT "LobbyMember_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LobbyMember_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LobbyMember_lobbyId_accountId_key" ON "LobbyMember"("lobbyId", "accountId");
