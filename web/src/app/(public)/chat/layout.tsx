import type { Metadata } from "next";
import { SITE_MAX_W } from "@/components/pouf/blocks";

// Личка живёт в продукте, а не в служебной части: это разговор игроков между собой.
// Колонка та же, что у остальных витрин, — край страницы совпадает с шапкой и ростером.

export const metadata: Metadata = { title: "Сообщения" };

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <main className={`mx-auto flex w-full ${SITE_MAX_W} flex-1 flex-col px-4 py-8 md:px-6`}>{children}</main>;
}
