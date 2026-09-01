import type { Metadata } from "next";
import { AppShell } from "../_components/app-shell";

// Публичная часть — то, что видит посетитель: разбор матча, таблица дивизиона, витрина ростера.
// Группа `(public)` на URL не влияет, она нужна ровно за тем, чтобы у продукта были свои
// метаданные, не общие со служебной частью.
//
// Хром с Э4b общий на обе группы: одна колонка слева, в ней и лига, и инструменты, и кабинет
// (DECISIONS, 02.09). Верхней строки сайта больше нет.

export const metadata: Metadata = {
  title: { default: "SPIRIT/CTRL", template: "%s — SPIRIT/CTRL" },
  description: "Разбор матчей Dota 2, таблица и составы лиги SPIRIT/CTRL",
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
