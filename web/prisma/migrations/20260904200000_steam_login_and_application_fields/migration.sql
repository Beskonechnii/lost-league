-- AlterTable: вход через Steam (OpenID) + фамилия/телефон в анкете игрока
ALTER TABLE "UserAccount" ADD COLUMN "steamId" TEXT;
ALTER TABLE "Player" ADD COLUMN "realSurname" TEXT;
ALTER TABLE "Player" ADD COLUMN "phone" TEXT;

CREATE UNIQUE INDEX "UserAccount_steamId_key" ON "UserAccount"("steamId");
