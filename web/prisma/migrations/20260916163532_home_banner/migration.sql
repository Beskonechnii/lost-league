-- CreateTable
CREATE TABLE "HomeBanner" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "title" TEXT,
    "text" TEXT,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "updatedAt" DATETIME NOT NULL
);
