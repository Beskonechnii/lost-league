import { googleConfigured } from "@/lib/google-oauth";
import { steamConfigured } from "@/lib/steam-oauth";
import { botConfigured } from "@/lib/telegram";
import { buttonClasses } from "@/components/pouf/Button";
import { AuthDivider } from "@/components/pouf/auth";
import { AuthForms } from "./auth-forms";

// ДВЕРЬ: всё, что видит НЕ вошедший, — формы «войти / зарегистрироваться» и ряд соц-входов.
// Отделена от кабинета на Э18: до этого оба экрана жили в одном `page.tsx` на 365 строк, где вход
// и воронка новичка правились в одном файле и мешали друг другу читаться.
//
// Оболочка (подушка, знак лиги, заголовок) — не здесь: её держит `AuthCard` Кита, общий у двери,
// кабинета и входа по коду из бота (`/login/tg`).

/** Круглая иконочная кнопка соц-входа — ряд из макета «Вход» («или через»). */
function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      title={label}
      aria-label={label}
      className={buttonClasses({ variant: "quiet", size: "lg", shape: "icon", className: "rounded-pill" })}
    >
      {children}
    </a>
  );
}

/** Не вошёл: формы email/пароль + соц-входы. */
export function Door() {
  return (
    <div>
      <AuthForms />

      {/* Ряд «или через» из макета. Телеграм ожил на Э19: привязка через бота появилась, значит у
          аккаунтов есть `tgId` — а с ним `/login/tg` (вход по коду из бота) ведёт в свой кабинет, а
          не в тупик. Кружок ведёт именно туда: одного нажатия мало (код нужно спросить у бота), и
          страница объясняет этот шаг словами. */}
      <AuthDivider>или через</AuthDivider>
      <div className="flex justify-center gap-3.5">
        {googleConfigured() && (
          <SocialLink href="/api/auth/google/start" label="Войти через Google">
            <GoogleIcon />
          </SocialLink>
        )}
        {botConfigured() && (
          <SocialLink href="/login/tg" label="Войти через Telegram">
            <TelegramIcon />
          </SocialLink>
        )}
        {steamConfigured() && (
          <SocialLink href="/api/auth/steam/start" label="Войти через Steam">
            <SteamIcon />
          </SocialLink>
        )}
      </div>
    </div>
  );
}

/** Официальный «G» четырёх цветов — узнаваемость кнопки входа. */
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

/** Фирменный самолётик Telegram — вход по коду из бота (`/login/tg`). */
function TelegramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#229ED9" aria-hidden="true">
      <path d="M21.9 4.34 3.2 11.3c-.9.35-.88 1.64.03 1.93l4.7 1.47 1.8 5.48c.24.72 1.12.9 1.63.35l2.55-2.68 4.66 3.44c.6.44 1.46.11 1.62-.62l3-14.35c.2-.95-.72-1.72-1.6-1.34zM9.7 15.05l-.28 3.9 2.03-2.83 5.6-5.9c.12-.13-.04-.32-.2-.22l-7.15 5.05z" />
    </svg>
  );
}

/** Фирменные шарики Steam — вход по привязанному Steam-аккаунту. */
function SteamIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#171a21" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 15.2 8 16.9" />
      <circle cx="9.4" cy="9.2" r="4" />
      <circle cx="9.4" cy="9.2" r="1.5" fill="#171a21" stroke="none" />
      <circle cx="16.4" cy="14.4" r="2.6" />
    </svg>
  );
}
