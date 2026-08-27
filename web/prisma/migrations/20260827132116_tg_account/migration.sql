-- AlterTable
ALTER TABLE "TgChat" ADD COLUMN "accountId" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT,
    "googleSub" TEXT,
    "passwordHash" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'player',
    "permissions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "application" TEXT,
    "policyAcceptedAt" DATETIME,
    "submittedAt" DATETIME,
    "reviewedAt" DATETIME,
    "reviewedById" INTEGER,
    "rejectedReason" TEXT,
    "tgId" TEXT,
    "tgUsername" TEXT,
    "source" TEXT NOT NULL DEFAULT 'web',
    "playerId" INTEGER,
    "claimId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserAccount_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserAccount_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_UserAccount" ("application", "avatar", "claimId", "createdAt", "email", "emailVerified", "googleSub", "id", "name", "passwordHash", "permissions", "playerId", "policyAcceptedAt", "rejectedReason", "reviewedAt", "reviewedById", "role", "status", "submittedAt") SELECT "application", "avatar", "claimId", "createdAt", "email", "emailVerified", "googleSub", "id", "name", "passwordHash", "permissions", "playerId", "policyAcceptedAt", "rejectedReason", "reviewedAt", "reviewedById", "role", "status", "submittedAt" FROM "UserAccount";
DROP TABLE "UserAccount";
ALTER TABLE "new_UserAccount" RENAME TO "UserAccount";
CREATE UNIQUE INDEX "UserAccount_email_key" ON "UserAccount"("email");
CREATE UNIQUE INDEX "UserAccount_googleSub_key" ON "UserAccount"("googleSub");
CREATE UNIQUE INDEX "UserAccount_tgId_key" ON "UserAccount"("tgId");
CREATE UNIQUE INDEX "UserAccount_playerId_key" ON "UserAccount"("playerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
