import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site";

// `/sitemap.xml`. Считается на запрос, а не на сборку: адрес сайта берётся из `siteUrl()`
// (`BASE_URL` → живой туннель → localhost), да и состав лиги меняется чаще, чем выкладывается
// код — карта, застывшая на момент сборки, врала бы про каждую новую команду.
export const dynamic = "force-dynamic";

/**
 * В карту идёт только то, что публично и заполнено. Намеренно не идут:
 *
 * • адреса-редиректы (`/players`, `/playoffs`, `/tp`, `/apply`, `/schedule`, `/standings/*`,
 *   `/tournaments/<слаг>` без дивизиона, `/mixcup` без слага — ТЗ 34) — карта должна называть
 *   цель, а не перевалочный адрес;
 * • черновики турниров — их наружу не показывает и сама страница (404);
 * • архив команд — второе из двух удалений, такой страницы для посетителя нет;
 * • всё служебное (`/admin`, `/me`, `/chat`, `/studio`, `/underbeer`, `/lobby`, `/overlay`) —
 *   оно и robots'ом закрыто, и `noindex`-ом в layout'ах групп.
 *
 * `lastModified` ставим только там, где есть честная дата: у встречи это день игры. У команд,
 * игроков и турниров поля «когда правили» в схеме нет — выдумывать «сегодня» на каждый обход
 * хуже, чем не указывать: поле необязательное, а вранью про свежесть поисковик перестаёт верить.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const url = (path: string) => `${base}${path}`;

  const [tournaments, teams, players, series, mixCupEvents] = await Promise.all([
    prisma.tournament.findMany({
      where: { status: { not: "draft" } },
      select: { slug: true, divisions: { select: { slug: true } } },
    }),
    prisma.team.findMany({ where: { archivedAt: null }, select: { id: true } }),
    // Непроверенный (Mix Cup до апрува, ТЗ 34) в карту не идёт — у него нет своей публичной
    // страницы (getPlayerProfile отдаёт null), ссылка из sitemap вела бы в 404.
    prisma.player.findMany({ where: { verified: true }, select: { slug: true } }),
    prisma.series.findMany({ select: { slug: true, playedAt: true } }),
    // Mix Cup (ТЗ 34): идут ВСЕ заведённые события серии независимо от статуса — сыгранный
    // Mix Cup такой же легитимный адрес, как .../about завершённого турнира.
    prisma.mixCupEvent.findMany({ select: { slug: true, status: true } }),
  ]);

  const entries: MetadataRoute.Sitemap = [
    { url: url("/"), priority: 1 },
    { url: url("/tournaments"), priority: 0.9 },
    { url: url("/tournaments/archive"), priority: 0.5 },
    { url: url("/roster"), priority: 0.8 },
    { url: url("/roster/players"), priority: 0.8 },
    { url: url("/series"), priority: 0.7 },
    { url: url("/rules"), priority: 0.4 },
    { url: url("/contact"), priority: 0.4 },
  ];

  for (const t of tournaments) {
    entries.push({ url: url(`/tournaments/${t.slug}/about`), priority: 0.8 });
    for (const d of t.divisions) entries.push({ url: url(`/tournaments/${t.slug}/${d.slug}`), priority: 0.8 });
  }
  // Команду адресует id, а не слаг: так на неё ссылается весь сайт, и карта не должна заводить
  // второй адрес той же страницы — это ровно то, из-за чего в индексе заводятся дубли.
  for (const t of teams) entries.push({ url: url(`/roster/teams/${t.id}`), priority: 0.7 });
  for (const p of players) entries.push({ url: url(`/players/${p.slug}`), priority: 0.7 });
  for (const s of series) {
    entries.push({ url: url(`/series/${s.slug}`), lastModified: s.playedAt ?? undefined, priority: 0.6 });
  }
  for (const e of mixCupEvents) {
    entries.push({ url: url(`/mixcup/${e.slug}`), priority: e.status === "open" ? 0.8 : 0.5 });
  }

  return entries;
}
