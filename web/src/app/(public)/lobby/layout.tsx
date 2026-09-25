import type { Metadata } from "next";
import { SITE_MAX_W } from "@/components/pouf/blocks";

// Лобби встречи — закрытая комната (ТЗ 22, решение 9): публичных адресов у раздела нет, посторонний
// получает 404. `noindex` — не защита, а гигиена: индексировать нечего, а в выдаче светиться незачем.

export const metadata: Metadata = {
  title: { default: "Лобби", template: "%s — лобби" },
  robots: { index: false, follow: false },
};

export default function LobbyLayout({ children }: { children: React.ReactNode }) {
  return <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>{children}</main>;
}
