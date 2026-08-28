-- CreateTable
CREATE TABLE "MatchRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "proposedStartAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_opponent',
    "opponentDecidedAt" DATETIME,
    "adminDecidedAt" DATETIME,
    "declineReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seriesId" INTEGER NOT NULL,
    "proposedByPlayerId" INTEGER NOT NULL,
    "parentId" INTEGER,
    CONSTRAINT "MatchRequest_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatchRequest_proposedByPlayerId_fkey" FOREIGN KEY ("proposedByPlayerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatchRequest_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MatchRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MatchRequest_seriesId_idx" ON "MatchRequest"("seriesId");

-- CreateIndex
CREATE INDEX "MatchRequest_status_idx" ON "MatchRequest"("status");
