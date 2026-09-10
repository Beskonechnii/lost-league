-- AlterTable: ранг игрока обзаводится памятью на один шаг назад и датой последней сверки.
-- rankPrev — значение до последней СМЕНЫ ранга (для дельты «было → стало»),
-- rankAt — когда ранг последний раз подтверждали у OpenDota (даже если он не менялся).
ALTER TABLE "Player" ADD COLUMN "rankPrev" INTEGER;
ALTER TABLE "Player" ADD COLUMN "rankAt" DATETIME;
