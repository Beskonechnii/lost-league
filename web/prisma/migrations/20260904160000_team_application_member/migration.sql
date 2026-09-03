-- CreateTable
CREATE TABLE "TeamApplicationMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "applicationId" INTEGER NOT NULL,
    "nickname" TEXT NOT NULL,
    "playerId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "invitedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    CONSTRAINT "TeamApplicationMember_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "TeamApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamApplicationMember_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TeamApplicationMember_playerId_status_idx" ON "TeamApplicationMember"("playerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TeamApplicationMember_applicationId_nickname_key" ON "TeamApplicationMember"("applicationId", "nickname");
