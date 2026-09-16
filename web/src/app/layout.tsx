import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// Шрифт для компонентов 1st-Pouf (класс font-pouf → 'Nunito Variable').
import "@fontsource-variable/nunito";
import { Toaster } from "@/components/pouf/toaster";
import { readTheme } from "@/lib/theme-store";
import { themeToStyle } from "@/lib/theme";
import { siteUrl } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Метаданные всего сайта. `generateMetadata`, а не константа: `metadataBase` берётся из адреса
 * сайта в рантайме (`BASE_URL` → живой туннель → localhost, см. `lib/site.ts`), а константа
 * застыла бы на том значении, что было в момент сборки — и превью на туннеле вели бы на localhost.
 *
 * Наружу лига называется SPIRIT/CTRL (решение 28.08.2026 в DECISIONS.md); «LOST» остаётся
 * внутренним именем — репозиторий, пути, токены. В заголовке вкладки внутреннего имени быть не
 * должно: посетитель видел то «SPIRIT/CTRL», то «LOST», то «League of Spirit».
 *
 * Шаблон `%s — SPIRIT/CTRL` держим здесь, а не в каждой группе маршрутов: имя лиги должно попадать
 * в видимую часть заголовка вкладки и превью, а группа может забыть его добавить. `og:image` сюда
 * не пишем — его даёт файл-конвенция `opengraph-image.tsx` рядом, одна картинка на весь сайт.
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: "SPIRIT/CTRL", template: "%s — SPIRIT/CTRL" },
    description: "Любительская лига по Dota 2: сезонные турниры, дивизионы, разбор матчей и рейтинг игроков.",
    applicationName: "SPIRIT/CTRL",
    openGraph: { type: "website", siteName: "SPIRIT/CTRL", locale: "ru_RU" },
    twitter: { card: "summary_large_image" },
  };
}

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
