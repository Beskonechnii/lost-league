-- ТЗ 38: желаемые роли участника на конкретный турнир, CSV ключей из src/lib/roles.ts.
-- Нулевое поле: у записей, сделанных до этой миграции, ролей нет и выдумывать их нечем.
ALTER TABLE "TournamentRegistration" ADD COLUMN "desiredRoles" TEXT;
