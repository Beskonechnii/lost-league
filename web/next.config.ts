import type { NextConfig } from "next";

// Кто имеет право встроить нас в <iframe>. Публичная часть задумана как раздел основного сайта
// (см. ARCHITECTURE.md), а без этого заголовка встраивание браузер просто заблокирует.
// Список доменов — в FRAME_ANCESTORS через пробел, например:
//   FRAME_ANCESTORS="'self' https://leagueofspirits.ru https://*.leagueofspirits.ru"
// По умолчанию — только мы сами: чужие домены вписывает тот, кто их знает, а не дефолт.
const frameAncestors = process.env.FRAME_ANCESTORS?.trim() || "'self'";

const nextConfig: NextConfig = {
  // Разъехавшиеся адреса админки. Редирект, а не удаление молча: адреса оседают в закладках
  // оператора. Панель ролей заменена «Командой лиги» (роль + гранулярные права), а две очереди
  // модерации («Регистрации» и «Заявки») слиты в один раздел с вкладками.
  async redirects() {
    return [
      { source: "/admin/roles", destination: "/admin/staff", permanent: true },
      { source: "/admin/registrations", destination: "/admin/moderation", permanent: true },
      { source: "/admin/claims", destination: "/admin/moderation?tab=links", permanent: true },
      // «Расписание» — это лента встреч разрезом «Будущие», отдельного экрана у него нет (ТЗ 10).
      // Конфигом, а не `redirect()` на странице: тот отдаёт 307, и каноническим остался бы сам
      // `/schedule` — то есть индексируемая пустышка. 308 передаёт вес цели и вычищает адрес.
      { source: "/schedule", destination: "/series?m=next", permanent: true },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Только frame-ancestors: полноценного CSP на приложение сейчас нет, а эта директива
          // работает сама по себе. X-Frame-Options намеренно не ставим — он умеет ровно один
          // домен и перебил бы список.
          { key: "Content-Security-Policy", value: `frame-ancestors ${frameAncestors};` },
        ],
      },
    ];
  },
};

export default nextConfig;
