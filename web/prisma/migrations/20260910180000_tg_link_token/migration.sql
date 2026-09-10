-- CreateTable: одноразовый токен привязки телеграма (deeplink `?start=link_<token>`, см. tg-link.ts)
CREATE TABLE "TgLinkToken" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL,
    "accountId" INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Токен — ключ от привязки, поэтому уникален так же, как код входа
CREATE UNIQUE INDEX "TgLinkToken_token_key" ON "TgLinkToken"("token");
