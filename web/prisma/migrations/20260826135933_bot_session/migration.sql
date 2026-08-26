-- CreateTable
CREATE TABLE "BotSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chatId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "BotSession_chatId_key" ON "BotSession"("chatId");
