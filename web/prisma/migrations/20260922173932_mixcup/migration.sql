-- CreateTable
CREATE TABLE "MixCupEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "stealEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lockEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "draftSessionId" INTEGER,
    CONSTRAINT "MixCupEvent_draftSessionId_fkey" FOREIGN KEY ("draftSessionId") REFERENCES "DraftSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MixCupTeam" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "orderNo" INTEGER NOT NULL,
    CONSTRAINT "MixCupTeam_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MixCupEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MixCupPick" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "teamId" INTEGER NOT NULL,
    "playerId" INTEGER,
    "nickname" TEXT NOT NULL,
    "isCaptain" BOOLEAN NOT NULL DEFAULT false,
    "orderNo" INTEGER NOT NULL,
    CONSTRAINT "MixCupPick_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "MixCupTeam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MixCupPick_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MixCupEvent_slug_key" ON "MixCupEvent"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "MixCupEvent_draftSessionId_key" ON "MixCupEvent"("draftSessionId");
