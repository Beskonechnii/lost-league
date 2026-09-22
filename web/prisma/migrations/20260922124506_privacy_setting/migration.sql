-- CreateTable
CREATE TABLE "PrivacySetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "showTelegram" BOOLEAN NOT NULL DEFAULT false,
    "showMmr" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);
