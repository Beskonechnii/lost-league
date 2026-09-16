import Link from "next/link";
import { AuthCard } from "@/components/pouf/auth";
import { botStartLink } from "@/lib/telegram";
import { RESET_TTL_MIN } from "@/lib/password-reset";
import { RequestForm } from "./request-form";

// «Забыли пароль?» — запрос ссылки на смену. Второй экран двери `/me`, оболочка та же (`AuthCard`).
//
// Писем лига не шлёт, поэтому ссылка уходит в телеграм тому, у кого он привязан. У кого нет —
// путь один: организатор выдаёт ссылку из админки. Оба исхода описаны на ОДНОМ экране-ответе
// (`request-form.tsx`) намеренно: разведи их — и форма начнёт отвечать «у этой почты телеграма
// нет», то есть подтверждать, что почта в лиге заведена.

export const dynamic = "force-dynamic";
// `noindex` приезжает из `login/layout.tsx`, `Referrer-Policy: no-referrer` — из `next.config.ts`
// (одним правилом на всю ветку `/login/reset`, чтобы токен из адреса не уехал в чужой реферер).
export const metadata = { title: "Забыли пароль" };

export default async function ResetRequestPage() {
  // Ссылка на бота — единственный канал к организатору у того, кто на сайт войти не может.
  // Бот не заведён (`TG_BOT_TOKEN` пуст) или Telegram не ответил — null, и текст ведёт на /contact.
  const botUrl = await botStartLink();

  return (
    <AuthCard title="Забыли пароль">
      <RequestForm botUrl={botUrl} ttlMin={RESET_TTL_MIN} />

      <p className="mt-5 text-center text-[13px] font-bold text-muted">
        Вспомнили —{" "}
        <Link href="/me" className="font-black text-[var(--accent-ink)] underline-offset-4 hover:underline">
          обычный вход
        </Link>
        .
      </p>
    </AuthCard>
  );
}
