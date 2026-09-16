-- AlterTable
ALTER TABLE "UserAccount" ADD COLUMN "passwordResetAt" DATETIME;
ALTER TABLE "UserAccount" ADD COLUMN "passwordResetById" INTEGER;
ALTER TABLE "UserAccount" ADD COLUMN "sessionsFrom" DATETIME;

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL,
    "accountId" INTEGER NOT NULL,
    "issuedById" INTEGER,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");
