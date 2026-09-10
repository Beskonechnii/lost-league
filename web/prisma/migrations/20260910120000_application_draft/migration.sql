-- AlterTable: черновик анкеты — незаконченный ввод квиза (сырой ApplicationInput + номер шага)
ALTER TABLE "UserAccount" ADD COLUMN "applicationDraft" TEXT;
