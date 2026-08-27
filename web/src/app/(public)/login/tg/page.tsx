import Link from "next/link";
import { currentAccountId } from "@/lib/player-session";
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
  const signedIn = (await currentAccountId()) != null;

  return (
    <main className="flex-1 px-4 py-10 md:py-16">
      <div className="mx-auto w-full max-w-md">
        {/* Шапка-марка — та же, что у кабинета: это один и тот же вход, с разных сторон */}
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-accent to-fuchsia-600 text-xl font-black text-white shadow-lg shadow-accent/20">
            L
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">Вход через Telegram</h1>
          <p className="mt-1 text-sm text-ink-muted">League of Spirits</p>
        </div>

        <div className="rounded-2xl border border-hairline bg-surface-1/60 p-5 shadow-xl shadow-black/20 backdrop-blur">
          {signedIn ? (
            <div className="space-y-3 text-sm">
              <p className="text-ink">Вы уже вошли — код не нужен.</p>
              <Link href="/me" className="text-accent underline-offset-4 hover:underline">
                Открыть кабинет →
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              <ol className="space-y-2 text-sm text-ink-muted">
                <li>
                  1. Напишите нашему боту: <b className="text-ink">«{MENU.profile}»</b> →{" "}
                  <b className="text-ink">«{MENU.login}»</b>.
                </li>
                <li>2. Он пришлёт шесть цифр — введите их сюда.</li>
              </ol>

              <CodeForm />

              <p className="text-xs text-ink-subtle">
                Код живёт {CODE_TTL_MIN} минут и срабатывает один раз. Не подошёл — попросите новый в боте.
              </p>

              <div className="border-t border-hairline pt-4 text-xs text-ink-subtle">
                Аккаунт с почтой и паролем —{" "}
                <Link href="/me" className="text-accent underline-offset-4 hover:underline">
                  обычный вход
                </Link>
                .
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
