import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// `/robots.txt`. Адрес карты берём из `siteUrl()` — той же функции, что кормит ссылки бота
// (`BASE_URL` → живой туннель → localhost). Поэтому файл считается на запрос, а не на сборку:
// иначе на туннеле в нём стоял бы localhost, и карту никто бы не нашёл.
export const dynamic = "force-dynamic";

/**
 * Закрываем ровно то, что закрыто `noindex`-ом в layout'ах групп маршрутов (ТЗ 03) — два правила
 * об одном, потому что robots.txt останавливает обход, а `noindex` вычищает уже проиндексированное:
 * страницу, которую запретили обходить, робот из выдачи не убирает — он просто перестаёт видеть
 * мета-тег. Пути с хвостовым слэшем — префиксы разделов; `/match` без него, там сам адрес — экран.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/api/",
          "/chat/",
          "/lobby/",
          "/login/",
          "/match",
          "/me/",
          "/overlay/",
          "/studio/",
          "/underbeer/",
        ],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
