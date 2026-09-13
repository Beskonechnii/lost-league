import type { Metadata } from "next";
import { AppShell } from "../_components/app-shell";

// Своя группа маршрутов у одной страницы — главной. Заводилась под свой хром витрины; с ТЗ 08
// хром у продукта один (`app-shell.tsx`), и группа осталась ради собственных метаданных и
// компонентов главной. На URL группа не влияет — главная остаётся `/`.

export const metadata: Metadata = {
  title: { default: "SPIRIT/CTRL", template: "%s — SPIRIT/CTRL" },
  description: "Разбор матчей Dota 2, таблица и составы лиги SPIRIT/CTRL",
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
