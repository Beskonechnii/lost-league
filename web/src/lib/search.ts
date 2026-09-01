// Только сервер: поиск по лиге — команды, игроки, турниры одним запросом. Кормит поле в шапке
// сайдбара (единственная навигация продукта), поэтому отвечает сразу карточками, на которые можно
// перейти, а не «страницей результатов»: страницы результатов у продукта нет и не планируется.
//
// Почему выборка целиком, а не WHERE ... LIKE: sqlite сравнивает LIKE без учёта регистра только для
// латиницы, кириллицу он не складывает («Гуз» не найдёт «гузлики»), а `mode: "insensitive"` Prisma
// на sqlite не поддерживает. В лиге две сотни игроков и полсотни команд — свести регистр в JS
// дешевле, чем городить теневую колонку с нормализованным именем ради одного поля ввода.

import "server-only";
import { prisma } from "./prisma";
import { resolveUpload } from "./uploads";

export type SearchKind = "team" | "player" | "tournament";

export type SearchHit = {
  kind: SearchKind;
  /** Что показать крупно — название команды, ник игрока, имя турнира. */
  title: string;
  /** Вторая строка: тег команды, настоящее имя игрока, статус турнира. Может отсутствовать. */
  subtitle: string | null;
  href: string;
  /** Лого/фото, если есть: узнают по картинке быстрее, чем по строке. */
  image: string | null;
};

/** Минимум символов, при котором есть смысл искать: на одной букве совпадёт половина лиги. */
export const MIN_QUERY = 2;

/** Сравниваем без регистра и без разницы ё/е — иначе «Алёна» не находится по «алена». */
const norm = (s: string) => s.toLocaleLowerCase("ru").replaceAll("ё", "е").trim();

/**
 * Насколько поле подходит запросу: 3 — совпало целиком, 2 — начинается с запроса, 1 — содержит,
 * 0 — не подходит. Ранг нужен, чтобы «Guzli» стоял выше «Guzliki Academy» при вводе «guzli».
 */
function score(field: string | null | undefined, q: string): number {
  if (!field) return 0;
  const v = norm(field);
  if (v === q) return 3;
  if (v.startsWith(q)) return 2;
  return v.includes(q) ? 1 : 0;
}

const best = (...scores: number[]) => Math.max(...scores);

/** Ранг вида сущности при равном совпадении: команду и турнир ищут чаще, чем отдельного игрока. */
const KIND_RANK: Record<SearchKind, number> = { tournament: 2, team: 1, player: 0 };

export async function searchLeague(query: string, limit = 8): Promise<SearchHit[]> {
  const q = norm(query);
  if (q.length < MIN_QUERY) return [];

  const [teams, players, tournaments] = await Promise.all([
    // Архивные команды не ищем: они убраны из пула, и переход вёл бы на карточку вне лиги.
    prisma.team.findMany({
      where: { archivedAt: null },
      select: { id: true, slug: true, name: true, tag: true, logo: true },
    }),
    prisma.player.findMany({ select: { id: true, slug: true, nickname: true, realName: true, photo: true } }),
    // Черновики турниров публично не существуют — так же, как на /tournaments.
    prisma.tournament.findMany({
      where: { status: { not: "draft" } },
      select: { slug: true, name: true, short: true, status: true, logo: true },
    }),
  ]);

  type Scored = { hit: Omit<SearchHit, "image"> & { slug: string; stored: string | null }; rank: number };
  const found: Scored[] = [];

  for (const t of teams) {
    const rank = best(score(t.name, q), score(t.tag, q), score(t.slug, q));
    if (rank)
      found.push({
        rank,
        hit: {
          kind: "team",
          title: t.name,
          subtitle: t.tag,
          href: `/roster/teams/${t.id}`,
          slug: t.slug,
          stored: t.logo,
        },
      });
  }

  for (const p of players) {
    const rank = best(score(p.nickname, q), score(p.realName, q), score(p.slug, q));
    if (rank)
      found.push({
        rank,
        hit: {
          kind: "player",
          title: p.nickname,
          subtitle: p.realName,
          href: `/roster/players/${p.id}`,
          slug: p.slug,
          stored: p.photo,
        },
      });
  }

  for (const t of tournaments) {
    const rank = best(score(t.name, q), score(t.short, q), score(t.slug, q));
    if (rank)
      found.push({
        rank,
        hit: {
          kind: "tournament",
          title: t.name,
          subtitle: t.short,
          href: `/tournaments/${t.slug}`,
          slug: t.slug,
          stored: t.logo,
        },
      });
  }

  const top = found
    .sort((a, b) => b.rank - a.rank || KIND_RANK[b.hit.kind] - KIND_RANK[a.hit.kind] || a.hit.title.localeCompare(b.hit.title, "ru"))
    .slice(0, limit);

  // Картинки разрешаем только у победителей: листинг папки кэширован, но лишних вызовов на всю
  // выборку это не оправдывает. У турнира фолбэка по слагу нет — своей папки в uploads у него
  // тоже нет, поэтому берём поле как есть.
  return Promise.all(
    top.map(async ({ hit }) => ({
      kind: hit.kind,
      title: hit.title,
      subtitle: hit.subtitle,
      href: hit.href,
      image:
        hit.kind === "tournament"
          ? hit.stored
          : await resolveUpload(hit.kind === "player" ? "players" : "teams", hit.slug, hit.kind === "player" ? "photo" : "logo", hit.stored),
    })),
  );
}
