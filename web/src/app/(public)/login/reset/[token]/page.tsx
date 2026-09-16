import Link from "next/link";
import { AuthCard } from "@/components/pouf/auth";
import { buttonClasses } from "@/components/pouf/Button";
import { Alert } from "@/components/pouf/feedback";
import { RESET_TTL_MIN, readResetToken, type ResetTokenState } from "@/lib/password-reset";
import { ResetForm } from "./reset-form";

// Смена пароля по одноразовой ссылке. Сюда приходят из бота (сам запросил) и от организатора
// (выдал в админке) — экран один: пароль в обоих случаях придумывает владелец аккаунта, и никто,
// кроме него, нового пароля не видит.
//
// Состояние ссылки проверяется ЗДЕСЬ, на отрисовке, и отдельными экранами, а не алертом над формой:
// «протухла» и «уже потрачена» — это не ошибка ввода, а конец пути, и предлагать под ними поля для
// пароля бессмысленно. Гасится ссылка только отправкой формы (`redeemReset`), не показом страницы:
// иначе предпросмотр ссылки в телеграме сжигал бы её, не доходя до человека.

export const dynamic = "force-dynamic";
export const metadata = { title: "Новый пароль" };

/** Текст отказа под каждое состояние ссылки. Одноразовость видна словами, а не догадкой. */
const DEAD: Record<Exclude<ResetTokenState, "ok">, { title: string; body: string }> = {
  unknown: {
    title: "Ссылка не подошла",
    body: "Такой ссылки у нас нет — возможно, адрес скопирован не целиком или ссылку уже заменила более новая.",
  },
  expired: {
    title: "Ссылка устарела",
    body: `Ссылка живёт ${RESET_TTL_MIN} минут — эта уже просрочена. Запросите новую, она придёт тем же путём.`,
  },
  used: {
    title: "Ссылка уже использована",
    body: "По ней пароль один раз сменили — второй раз она не сработает. Если это были не вы, запросите новую прямо сейчас.",
  },
};

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const state = await readResetToken(token);

  if (state !== "ok") {
    const { title, body } = DEAD[state];
    return (
      <AuthCard title={title}>
        <div className="space-y-4">
          <Alert tone="warn" block>
            {body}
          </Alert>
          <Link href="/login/reset" className={buttonClasses({ size: "lg", block: true })}>
            Запросить новую ссылку
          </Link>
          <p className="text-center text-[13px] font-bold text-muted">
            Помните пароль —{" "}
            <Link href="/me" className="font-black text-[var(--accent-ink)] underline-offset-4 hover:underline">
              обычный вход
            </Link>
            .
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Новый пароль">
      <ResetForm token={token} />
    </AuthCard>
  );
}
