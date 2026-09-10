import type { Metadata } from "next";
import { HomeShell } from "../_components/home-shell";

// Своя группа маршрутов у одной страницы — главной. Нужна ровно за тем, что хром у витрины
// другой: сайдбара нет, вместо него верхняя строка с аватар-меню (`home-shell.tsx`, решение
// 09.09). Layout не знает адреса, поэтому «убрать колонку на одном маршруте» решается только
// группой; на URL группа не влияет — главная остаётся `/`.

export const metadata: Metadata = {
  title: { default: "SPIRIT/CTRL", template: "%s — SPIRIT/CTRL" },
  description: "Разбор матчей Dota 2, таблица и составы лиги SPIRIT/CTRL",
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <HomeShell>{children}</HomeShell>;
}
