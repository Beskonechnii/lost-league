// Только сервер: лимиты частоты. Два разных ограничения на одном механизме — скользящее окно
// в памяти процесса.
//
// Счётчики живут в памяти: приложение одно и на одной машине (DEPLOY.md), заводить ради лимита
// Redis незачем. Цена — рестарт обнуляет окно; и для защиты внешней квоты, и для защиты от
// перебора пароля это приемлемо (перебиратель не умеет ронять наш процесс по требованию).

const hits = new Map<string, number[]>();

/** Самое длинное из заведённых окон — по нему чистим общую карту. */
const MAX_WINDOW_MS = 15 * 60_000;

export type RateVerdict = { ok: true } | { ok: false; retryAfterSec: number };

export interface Limiter {
  /** Занять слот. Ключ — всё, по чему считаем: IP, почта, пара из них. */
  take(key: string): RateVerdict;
  /** Забыть ключ: попытка удалась, копить её нечего (см. лимит входа). */
  reset(key: string): void;
}

/**
 * Лимитер: своё окно и свой потолок, общая карта попыток.
 *
 * Карта общая на все лимитеры, поэтому ключи разводятся префиксом — иначе IP, зашедший
 * за разбором матча, тратил бы попытки входа и наоборот.
 */
export function createLimiter({ prefix, windowMs, limit }: { prefix: string; windowMs: number; limit: number }): Limiter {
  const at = (key: string) => `${prefix}:${key}`;

  return {
    take(key) {
      const slot = at(key);
      const now = Date.now();
      const fresh = (hits.get(slot) ?? []).filter((t) => now - t < windowMs);

      if (fresh.length >= limit) {
        hits.set(slot, fresh);
        return { ok: false, retryAfterSec: Math.ceil((windowMs - (now - fresh[0])) / 1000) };
      }

      fresh.push(now);
      hits.set(slot, fresh);

      // Уборка прицепом к запросу: отдельный таймер держал бы процесс живым и в дев-режиме
      // перезапускался бы на каждой перекомпиляции. Карта маленькая, обход дешёвый.
      // Окно берём самое длинное из заведённых — чужие записи чистить по своему нельзя.
      if (hits.size > 1000) {
        for (const [k, times] of hits) if (times.every((t) => now - t >= MAX_WINDOW_MS)) hits.delete(k);
      }

      return { ok: true };
    },
    reset(key) {
      hits.delete(at(key));
    },
  };
}

/**
 * Запросы наружу (OpenDota) — 10 в минуту с одного IP.
 *
 * Зачем. Публичный разбор матча ходит в OpenDota, а её лимит (~60 запросов в минуту) общий на всех
 * пользователей интернета. Один скрипт, перебирающий id матчей через наш сервер, сожжёт его целиком
 * и заодно подставит STEAM_API_KEY. Поэтому наружу пускаем считанное число запросов с одного IP:
 * человеку с запасом, скрипту — нет.
 *
 * Считаем только промахи кэша: отдача с полки ничего не стоит и лимит не расходует — популярная
 * ссылка на отчёт должна открываться у всех и всегда (см. lib/match-cache.ts).
 */
const outbound = createLimiter({ prefix: "out", windowMs: 60_000, limit: 10 });

/**
 * Попытки входа по паролю — 10 за 15 минут на пару «почта + IP».
 *
 * Ключ парный не случайно. Только по почте — и любой желающий запирает чужой аккаунт, засыпав
 * форму мусором. Только по IP — и общий выход в интернет (офис, мобильный оператор) отрубает всех
 * разом. Пара оставляет перебирателю ровно то, что он и так может: свой канал против одной почты.
 */
const loginAttempts = createLimiter({ prefix: "login", windowMs: 15 * 60_000, limit: 10 });

/**
 * IP клиента из заголовков. За обратным прокси (в проде — Caddy, см. DEPLOY.md) настоящий адрес
 * приходит заголовком; берём первый хоп. Заголовок подделывается кем угодно, поэтому годится он
 * ровно для лимита, а не для доступа: подменивший его получит другое окно, но не чужие права.
 */
export function clientIpFromHeaders(h: Headers): string {
  const fwd = h.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "local";
}

/** То же для роут-хендлера, у которого на руках Request. */
export function clientIp(req: Request): string {
  return clientIpFromHeaders(req.headers);
}

/**
 * Занять слот внешнего запроса. Вызывать перед самым походом наружу — иначе лимит съедят
 * ответы из кэша.
 */
export function takeSlot(ip: string): RateVerdict {
  return outbound.take(ip);
}

/** Занять попытку входа. Зовётся ДО проверки пароля, чтобы считались и промахи по несуществующей почте. */
export function takeLoginAttempt(email: string, ip: string): RateVerdict {
  return loginAttempts.take(`${email}|${ip}`);
}

/** Вход удался — окно сбрасываем: считать надо неудачи, а не активность живого человека. */
export function clearLoginAttempts(email: string, ip: string): void {
  loginAttempts.reset(`${email}|${ip}`);
}
