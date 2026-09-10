-- CreateTable: реестр начислений осколков (валюта активности, отдельная от TP — см. src/lib/shards.ts).
-- Ключ `key` уникален по всей таблице: это анти-абуз — веха оплачивается один раз на игровой аккаунт.
CREATE TABLE "ShardEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShardEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "UserAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ShardEntry_key_key" ON "ShardEntry"("key");

-- CreateIndex
CREATE INDEX "ShardEntry_accountId_idx" ON "ShardEntry"("accountId");
