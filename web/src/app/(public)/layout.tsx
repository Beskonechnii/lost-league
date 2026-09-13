import type { Metadata } from "next";
import { AppShell } from "../_components/app-shell";

// Публичная часть — то, что видит посетитель: разбор матча, таблица дивизиона, витрина ростера.
// Группа `(public)` на URL не влияет, она нужна ровно за тем, чтобы у продукта были свои
// метаданные, не общие со служебной частью.
//
// Хром общий на все три группы маршрутов — верхний бар `_components/app-shell.tsx` (ТЗ 08,
// решение 13.09). Левой колонки больше нет.

export const metadata: Metadata = {
  title: { default: "SPIRIT/CTRL", template: "%s — SPIRIT/CTRL" },
  description: "Разбор матчей Dota 2, таблица и составы лиги SPIRIT/CTRL",
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
