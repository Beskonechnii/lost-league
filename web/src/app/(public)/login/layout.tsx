import type { Metadata } from "next";

// Экраны входа (сейчас один — вход по коду из телеграм-бота). Индексировать нечего: страница
// осмысленна только с одноразовым токеном в адресе, а без него это форма ошибки.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
