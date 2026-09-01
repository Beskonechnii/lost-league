import type { Metadata } from "next";
import { AppShell } from "../_components/app-shell";

// Служебная часть: студия графики, правка ростера, драфты. Всё это закрыто ролью и правами
// (`needsAdmin()` в src/lib/auth.ts) и посетителю не показывается.
//
// noindex — не защита, а гигиена: страницы и так за паролем, но светиться в выдаче им незачем.
//
// Хром тот же, что у продукта: с Э4b сайдбар один на обе группы маршрутов, инструменты — его
// секции, срезанные правами (DECISIONS, 02.09). Отдельного сайдбара операторской больше нет,
// и кнопок «Назад» тоже: возвращаться некуда, всё видно всегда.

export const metadata: Metadata = {
  title: { default: "Админка — LOST", template: "%s — админка LOST" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
