import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// Шрифт для компонентов 1st-Pouf (класс font-pouf → 'Nunito Variable').
import "@fontsource-variable/nunito";
import { Toaster } from "@/components/pouf/toaster";
import { readTheme } from "@/lib/theme-store";
import { themeToStyle } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LOST — League of Spirit",
  description: "Стата матчей, таблица лиги и студия графики League of Spirit",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Тема UI из data/theme.json → сырые токены (--lost-* и --accent) прямо на <html>=:root, инлайновым
  // style. Токены в globals.css развёрнуты в var(--lost-*, fallback), поэтому один объект перекрашивает
  // весь сайт. Значения санитайзятся в themeToStyle. Style-атрибут (а не <style>-тег) — чтобы не
  // связываться с хостингом стилей в React и чисто обновляться. Правит панель /admin/theme.
  const themeStyle = themeToStyle(await readTheme());
  return (
    <html
      lang="ru"
      style={themeStyle}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Навигации здесь намеренно нет: она своя у каждой группы маршрутов —
          (public)/layout.tsx для продукта и (admin)/layout.tsx для служебной части. */}
      <body className="flex min-h-full flex-col bg-canvas font-sans text-ink">
        {children}
        {/* Тосты (sonner) — один хост на весь сайт; заменяют webview-глохнущий alert(). */}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
