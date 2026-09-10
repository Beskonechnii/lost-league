import { redirect } from "next/navigation";
import { playerPath } from "@/lib/profiles";
import { currentAccount, accountStatus } from "@/lib/account";
import { Alert } from "@/components/pouf/feedback";
import { AuthCard } from "@/components/pouf/auth";
import { Door } from "./door";
import { Cabinet, cabinetIsWide } from "./cabinet";

export const dynamic = "force-dynamic";
export const metadata = { title: "Кабинет" };

// Единственный вход в систему и кабинет игрока до одобрения. Публичная страница (в needsAdmin не
// значится) — иначе входить было бы некуда.
//
// Здесь остался только выбор: не вошёл — дверь (`door.tsx`), вошёл — кабинет (`cabinet.tsx`).
// Всё остальное разъехалось по этим двум файлам на Э18: одним куском страница успела дорасти до
// 365 строк, где формы входа и воронка новичка правились вперемешку.
//
// Оболочка — `AuthCard` Кита (канонический макет «Вход»), общая со входом по коду из бота.

// Тексты сообщений из ?error, которыми google/steam-callback уводят обратно (коды — там же).
const ERRORS: Record<string, string> = {
  off: "Этот способ входа не настроен на сервере.",
  state: "Сессия входа истекла или не совпала. Попробуйте войти ещё раз.",
  google: "Google не подтвердил вход. Попробуйте ещё раз.",
  steam: "Steam не подтвердил вход. Попробуйте ещё раз.",
  // Привязка Steam к аккаунту с почтой упёрлась в чужую привязку. Молча пустить в тот аккаунт
  // нельзя — это и был бы вход под чужим именем (steam-callback, случай «занят»).
  "steam-taken": "Этот аккаунт Steam уже привязан к другому профилю лиги.",
  // Привязка телеграма: бота нет в окружении или Telegram не ответил (`api/tg/link/start`).
  "tg-off": "Бот лиги сейчас недоступен — привязать телеграм не выйдет. Впишите хендл руками, мы свяжемся по нему.",
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const account = await currentAccount();
  // У одобренного игрока кабинет и профиль — одна и та же страница (решение 04.09.2026): всё, что
  // кабинет показывал про него самого, лежит на его странице в лиге, а служебное про аккаунт —
  // в настройках. Здесь остаётся ровно то, чего на той странице быть не может: вход, анкета,
  // ожидание решения и привязка профиля.
  if (account?.player && accountStatus(account) === "active") redirect(playerPath(account.player));

  return (
    <AuthCard title={account ? "Личный кабинет" : "Вход в лигу"} wide={!!account && cabinetIsWide(account)}>
      {error && ERRORS[error] && (
        <div className="mb-4">
          <Alert tone="err" block>
            {ERRORS[error]}
          </Alert>
        </div>
      )}
      {account ? <Cabinet account={account} /> : <Door />}
    </AuthCard>
  );
}
