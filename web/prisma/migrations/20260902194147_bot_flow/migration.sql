-- AlterTable
ALTER TABLE "BotSession" ADD COLUMN "flowNode" TEXT;
ALTER TABLE "BotSession" ADD COLUMN "flowVars" TEXT;
ALTER TABLE "BotSession" ADD COLUMN "flowVersion" INTEGER;

-- CreateTable
CREATE TABLE "BotFlow" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "graph" TEXT NOT NULL,
    "note" TEXT,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "BotFlow_key_version_key" ON "BotFlow"("key", "version");
