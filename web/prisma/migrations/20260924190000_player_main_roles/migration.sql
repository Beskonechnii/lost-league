-- ТЗ 41: основные роли игрока — до двух, ключи roles.ts строкой (тот же формат, что desiredRoles).
ALTER TABLE "Player" ADD COLUMN "mainRoles" TEXT;
ALTER TABLE "Player" ADD COLUMN "mainRolesAt" DATETIME;

-- Переносим только то, что игрок выбрал сам: позицию из своей анкеты (UserAccount.application —
-- JSON). Из ростера роли НЕ заполняем (решение Стаса 24.09.2026): место в составе ставит оператор,
-- а это заявление человека о себе. Идемпотентно: уже заполненное поле повторный прогон не трогает,
-- json_valid отсекает битую анкету (json_extract на ней падает и уронил бы миграцию).
UPDATE "Player"
SET "mainRoles" = (
  SELECT json_extract(a."application", '$.position')
  FROM "UserAccount" a
  WHERE a."playerId" = "Player"."id"
    AND a."application" IS NOT NULL
    AND json_valid(a."application")
    AND json_extract(a."application", '$.position') IN
        ('carry', 'mid', 'offlane', 'soft-support', 'hard-support', 'standin', 'coach')
)
WHERE "mainRoles" IS NULL;
