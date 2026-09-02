import Link from "next/link";
import { currentAccount } from "@/lib/account";
import { AuthCard, AuthDivider } from "@/components/pouf/auth";
import { CODE_TTL_MIN } from "@/lib/tg-login";
import { MENU } from "@/lib/tg-menu";
import { CodeForm } from "./code-form";

// Вход по одноразовому коду из телеграм-бота. Второй вход в тот же кабинет, что и `/me`: у
// зарегистрированного через бота нет ни почты, ни пароля (BOT-PLAN.md, Э2), а сборка состава и
// кабинет живут на сайте.
//
// Страница публичная (в `needsAdmin` не значится) — иначе входить было бы некуда. Код проверяется
// только по нажатию кнопки: ссылка из бота специально идёт без кода в адресе, чтобы его не сжёг
// предпросмотр ссылки или чужой глаз в истории браузера.

export const dynamic = "force-dynamic";
export const metadata = { title: "Вход через Telegram" };

export default async function TelegramLoginPage() {
  // «Вошёл» = аккаунт нашёлся в базе, а не «кука расшифровалась». Кука подписана и живёт 30 дней,
  // так что она переживает удаление аккаунта, сброс базы и смену устройства: страница показывала
  // «вы уже вошли», а `/me` в соседней вкладке — форму входа, потому что кабинет спрашивает
  // `currentAccount()`. Оба экрана теперь спрашивают одно и то же.
  const signedIn = (await currentAccount()) != null;

  // Оболочка — общий `AuthCard` Кита (канон «Вход»): та же подушка с марочной шапкой, что у
  // кабинета `/me`. До Э8 она была сверстана здесь по месту, и второе окно входа завело бы
  // её копию. Из макета взята только оболочка: почта с паролем, соц-входы и квиз регистрации
  // живут в `/me`, а одноразовый код из бота — здесь, его в макете нет.
  return (
    <AuthCard title="Вход через Telegram">
      {signedIn ? (
        <div className="space-y-3 text-sm font-bold">
          <p className="text-ink">Вы уже вошли — код не нужен.</p>
          <Link href="/me" className="font-black text-[var(--accent-ink)] underline-offset-4 hover:underline">
            Открыть кабинет →
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          <ol className="space-y-2 text-sm font-bold text-muted">
            <li>
              1. Напишите нашему боту: <b className="font-black text-ink">«{MENU.profile}»</b> →{" "}
              <b className="font-black text-ink">«{MENU.login}»</b>.
            </li>
            <li>2. Он пришлёт шесть цифр — введите их сюда.</li>
          </ol>

          <CodeForm />

          <p className="text-xs font-bold text-muted">
            Код живёт {CODE_TTL_MIN} минут и срабатывает один раз. Не подошёл — попросите новый в боте.
          </p>

          <AuthDivider>или</AuthDivider>

          <p className="text-center text-[13px] font-bold text-muted">
            Аккаунт с почтой и паролем —{" "}
            <Link href="/me" className="font-black text-[var(--accent-ink)] underline-offset-4 hover:underline">
              обычный вход
            </Link>
            .
          </p>
        </div>
      )}
    </AuthCard>
  );
}
