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

  // Окно входа — по канону «Вход» из скилла `kit`: подушка-карточка с марочной шапкой
  // (знак и заголовок по центру) и разделителем перед «другим способом войти».
  //
  // Из макета взята только эта оболочка. Внутри у него почта с паролем, соц-входы и квиз
  // регистрации в три шага — это экран кабинета `/me`, отдельная страница; здесь живёт
  // одноразовый код из бота, которого в макете нет.
  return (
    <main className="flex-1 px-4 py-10 font-pouf md:py-16">
      <div className="mx-auto w-full max-w-[420px] rounded-[36px] bg-surface px-8 pb-7 pt-8 cushion-card">
        <div className="mb-6 flex flex-col items-center gap-3">
          {/* Знак вместо буквы в градиентном квадрате: у бренда своя лента, и рисовать её
              градиентом Tailwind значит держать вторую версию логотипа в классах. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/brand/mark.svg" alt="" aria-hidden className="h-14 w-auto" />
          <h1 className="text-[22px] font-black tracking-[-0.5px] text-ink">Вход через Telegram</h1>
        </div>

        {signedIn ? (
          <div className="space-y-3 text-sm font-bold">
            <p className="text-ink">Вы уже вошли — код не нужен.</p>
            <Link href="/me" className="font-black text-[var(--accent-ink)] underline-offset-4 hover:underline">
              Открыть кабинет →
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            <ol className="space-y-2 text-sm font-bold text-ink-muted">
              <li>
                1. Напишите нашему боту: <b className="font-black text-ink">«{MENU.profile}»</b> →{" "}
                <b className="font-black text-ink">«{MENU.login}»</b>.
              </li>
              <li>2. Он пришлёт шесть цифр — введите их сюда.</li>
            </ol>

            <CodeForm />

            <p className="text-xs font-bold text-ink-subtle">
              Код живёт {CODE_TTL_MIN} минут и срабатывает один раз. Не подошёл — попросите новый в боте.
            </p>

            {/* Разделитель «или» из макета: он отделяет основной способ входа от запасного. */}
            <div className="flex items-center gap-3.5 text-[11px] font-extrabold uppercase tracking-[1px] text-ink-subtle before:h-px before:flex-1 before:bg-hairline after:h-px after:flex-1 after:bg-hairline">
              или
            </div>

            <p className="text-center text-[13px] font-bold text-muted">
              Аккаунт с почтой и паролем —{" "}
              <Link href="/me" className="font-black text-[var(--accent-ink)] underline-offset-4 hover:underline">
                обычный вход
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
