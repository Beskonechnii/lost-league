-- CreateTable
CREATE TABLE "BotSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "BotSetting_key_key" ON "BotSetting"("key");
