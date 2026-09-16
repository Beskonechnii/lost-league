import type { Metadata } from "next";

// Кабинет игрока: профиль, вход и защита, настройки. Своей обёртки у раздела нет — колонку и
// хром задаёт `(public)/layout.tsx`; этот layout заведён ради одной строки метаданных.
//
// `noindex` — на уровне раздела, а не по страницам (ТЗ 03): экранов в кабинете прибавляется, и
// правило должно держаться само, когда добавят следующий. Это не защита — она в `currentAccount()`;
// это гигиена: личный кабинет в выдаче не место.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
