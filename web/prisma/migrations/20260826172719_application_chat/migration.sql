-- AlterTable
ALTER TABLE "TeamApplication" ADD COLUMN "submittedChatId" TEXT;

-- CreateTable
CREATE TABLE "TgChat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chatId" TEXT NOT NULL,
    "username" TEXT,
    "seenAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "TgChat_chatId_key" ON "TgChat"("chatId");
