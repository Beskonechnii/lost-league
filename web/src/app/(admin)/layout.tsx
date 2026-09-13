import type { Metadata } from "next";
import { AppShell } from "../_components/app-shell";

// Служебная часть: студия графики, правка ростера, драфты. Всё это закрыто ролью и правами
// (`needsAdmin()` в src/lib/auth.ts) и посетителю не показывается.
//
// noindex — не защита, а гигиена: страницы и так за паролем, но светиться в выдаче им незачем.
//
// Хром тот же, что у продукта: верхний бар на все три группы маршрутов (ТЗ 08). Инструментов в
// баре нет — там один пункт «Админ», ведущий на хаб `/admin`; он же и возврат с любого
// служебного экрана, поэтому кнопок «Назад» здесь не заводится.

export const metadata: Metadata = {
  title: { default: "Админка — LOST", template: "%s — админка LOST" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
