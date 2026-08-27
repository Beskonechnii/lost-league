-- CreateTable
CREATE TABLE "ProfileEditRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "chatId" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "reviewedById" INTEGER,
    "playerId" INTEGER NOT NULL,
    CONSTRAINT "ProfileEditRequest_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProfileEditRequest_playerId_idx" ON "ProfileEditRequest"("playerId");
