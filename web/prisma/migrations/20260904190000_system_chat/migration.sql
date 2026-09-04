-- AlterTable: служебный аккаунт лиги («Spirit CTRL») и системные сообщения с выбором
ALTER TABLE "UserAccount" ADD COLUMN "system" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChatMessage" ADD COLUMN "kind" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN "payload" TEXT;
