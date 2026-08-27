import type { Metadata } from "next";
import { PublicNav } from "../_components/site-nav";
import { isAdmin } from "@/lib/admin-session";

// Публичная часть — то, что видит посетитель: разбор матча, таблица дивизиона, витрина ростера.
// Группа `(public)` на URL не влияет, она нужна ровно за тем, чтобы у продукта были своя
// навигация и свои метаданные, не общие со служебной частью.

export const metadata: Metadata = {
  title: { default: "SPIRIT/CTRL", template: "%s — SPIRIT/CTRL" },
  description: "Разбор матчей Dota 2, таблица и составы лиги SPIRIT/CTRL",
};

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicNav isAdmin={await isAdmin()} />
      {children}
    </>
  );
}
