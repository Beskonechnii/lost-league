import { readTheme } from "@/lib/theme-store";
import { ThemeAdmin } from "./_components/theme-admin";
import { denyUnlessPermission } from "../../_components/permission-gate";
import { SITE_MAX_W } from "@/components/pouf/blocks";

export const metadata = { title: "Тема" };

// Панель управления цветами UI. Текущие значения читаем на сервере из data/theme.json и отдаём в
// редактор; тот правит локально (живое превью) и сохраняет через PUT /api/theme.

export default async function ThemePage() {
  const denied = await denyUnlessPermission("theme", "Тема");
  if (denied) return denied;

  const theme = await readTheme();
  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <ThemeAdmin initial={theme} />
    </main>
  );
}
