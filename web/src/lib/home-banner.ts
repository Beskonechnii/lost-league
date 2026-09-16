// Баннер главной: типы, пределы полей и единственное правило «задан / не задан».
//
// Правило здесь, а не в вёрстке, потому что его спрашивают трое: герой главной (показывать ли
// баннер вместо ветки по данным), форма правки (чего не хватает) и роут записи (что принять).
// Разъедься оно по трём файлам — и на главной однажды окажется заголовок без кнопки.
//
// Модуль ЧИСТЫЙ (ни БД, ни fs) — его тянет клиентская форма правки; чтение и запись живут
// рядом в home-banner-store.ts. То же деление, что у темы (theme.ts / theme-store.ts).

/** Пределы полей — они же `maxLength` в форме. Числа из DESIGN: длина, при которой верхний ряд
 *  главной ещё держит высоту (48 знаков заголовка дают 2 строки на 390, 28 знаков в кнопке ломают
 *  её на две строки и рвут нижний край ряда). Ограничение стоит на поле, а не проверкой после
 *  сохранения: оператор должен упереться в границу, пока печатает. */
export const BANNER_LIMITS = { title: 48, text: 140, ctaLabel: 24 } as const;

export type BannerDraft = {
  enabled: boolean;
  image: string | null;
  title: string | null;
  text: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
};

/** Баннер, который точно можно показать: все поля на месте. */
export type ActiveBanner = {
  image: string;
  title: string;
  text: string;
  cta: { href: string; label: string; external: boolean };
};

export const EMPTY_BANNER: BannerDraft = { enabled: false, image: null, title: null, text: null, ctaLabel: null, ctaHref: null };

/** Поля, без которых баннер не баннер, — в порядке формы. */
const REQUIRED = [
  ["image", "картинка"],
  ["title", "заголовок"],
  ["text", "подпись"],
  ["ctaLabel", "надпись кнопки"],
  ["ctaHref", "адрес кнопки"],
] as const;

/** Внешний адрес открывается в новой вкладке; внутренний — обычный переход по сайту. */
export const isExternalHref = (href: string) => /^https?:\/\//i.test(href.trim());

/** Чего не хватает, чтобы баннер показался. Пусто — заполнен целиком. */
export function missingFields(draft: BannerDraft): string[] {
  return REQUIRED.filter(([key]) => !draft[key]?.trim()).map(([, label]) => label);
}

/** Баннер для главной — или null, и тогда работает герой по данным ЦЕЛИКОМ. */
export function activeBanner(draft: BannerDraft): ActiveBanner | null {
  if (!draft.enabled || missingFields(draft).length > 0) return null;
  const href = draft.ctaHref!.trim();
  return {
    image: draft.image!.trim(),
    title: draft.title!.trim(),
    text: draft.text!.trim(),
    cta: { href, label: draft.ctaLabel!.trim(), external: isExternalHref(href) },
  };
}
