import type { Metadata } from "next";

// Лобби встречи — закрытая комната (ТЗ 22, решение 9): публичных адресов у раздела нет, посторонний
// получает 404. `noindex` — не защита, а гигиена: индексировать нечего, а в выдаче светиться незачем.

export const metadata: Metadata = {
  title: { default: "Лобби", template: "%s — лобби" },
  robots: { index: false, follow: false },
};

export default function LobbyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
