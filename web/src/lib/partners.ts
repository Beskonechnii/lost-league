// Партнёры-организаторы событий (Mix Cup by Eclipse, ТЗ 33). Отдельно от роутера ростера:
// это не команда лиги, а внешний клуб, и ассетов у него своя папка — public/assets/partners/.
//
// Ассетов Eclipse в репозитории ещё нет (MANUAL-TASKS §7) — src остаётся null, PartnerMark сам
// рисует запасную пилюлю «Партнёр — Eclipse». Как файл ляжет в assets/partners/, путь меняется
// только здесь: раскладку это переживает без правок (см. `pouf/media.tsx` → PartnerMark).
export const ECLIPSE_PARTNER = {
  name: "Eclipse",
  src: null as string | null,
};
