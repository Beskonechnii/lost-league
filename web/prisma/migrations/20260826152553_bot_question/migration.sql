-- CreateTable
CREATE TABLE "BotQuestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "custom" BOOLEAN NOT NULL DEFAULT false,
    "text" TEXT NOT NULL,
    "options" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "orderNo" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "BotQuestion_key_key" ON "BotQuestion"("key");
