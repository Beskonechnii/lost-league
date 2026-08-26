-- CreateTable
CREATE TABLE "PlayerDistinct" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "aId" INTEGER NOT NULL,
    "bId" INTEGER NOT NULL,
    "decidedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" INTEGER
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerDistinct_aId_bId_key" ON "PlayerDistinct"("aId", "bId");
