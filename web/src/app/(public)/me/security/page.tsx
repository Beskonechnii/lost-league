import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/account";
import { AUTH_MAX_W } from "@/components/pouf/blocks";
import { Breadcrumbs } from "@/app/_components/breadcrumbs";
import { PasswordForm, DeleteAccount } from "./security-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Вход и защита" };

// Отдельная приватная страница управления входом (решение Q5): способы входа, пароль, удаление
// аккаунта. Доступна любому вошедшему — привязка к игроку тут не нужна.
//
// Писем в проекте нет, поэтому подтверждать почту тут нечем: строку «Почта» показываем, только
// когда её подтвердил Google (docs/archive/ACCOUNTS-PLAN.md §3).

/** Строка статуса способа входа — как «connected accounts» на привычных сайтах. */
function MethodRow({ label, on, onText, offText }: { label: string; on: boolean; onText: string; offText?: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-ink">{label}</span>
      <span
        className={`rounded-full border px-2.5 py-0.5 text-xs ${
          on
            ? "border-emerald-200 bg-emerald-100 text-emerald-700"
            : "border-hairline bg-surface-2/40 text-ink-subtle"
        }`}
      >
        {on ? onText : offText}
      </span>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-hairline bg-surface-1/60 p-5 shadow-xl shadow-black/20 backdrop-blur">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {desc && <p className="mt-1 mb-3 text-xs text-ink-subtle">{desc}</p>}
      <div className={desc ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

export default async function SecurityPage() {
  const account = await currentAccount();
  if (!account) redirect("/me");

  const hasPassword = !!account.passwordHash;
  const hasGoogle = !!account.googleSub;

  return (
    <main className="flex-1 px-4 py-10 md:py-16">
      <div className={`mx-auto w-full ${AUTH_MAX_W} space-y-4`}>
        <div className="mb-2">
          {/* Крошки вместо «← Кабинет» — см. UI-GUIDELINES §3. */}
          <Breadcrumbs items={[{ href: "/me", label: "Кабинет" }]} />
          <h1 className="mt-3 text-2xl font-bold tracking-tight">Вход и защита</h1>
          {/* Почты может не быть: аккаунт из бота входит по телеграму (BOT-PLAN.md, Э1–Э2). */}
          <p className="mt-1 text-sm text-ink-muted">
            {account.email ?? (account.tgUsername ? `@${account.tgUsername}` : "вход через Telegram")}
          </p>
        </div>

        <Section title="Способы входа">
          <div className="divide-y divide-hairline">
            <MethodRow label="Google" on={hasGoogle} onText="привязан" offText="не привязан" />
            <MethodRow label="Пароль" on={hasPassword} onText="задан" offText="не задан" />
            {account.emailVerified && <MethodRow label="Почта" on onText="подтверждена Google" />}
          </div>
        </Section>

        <Section
          title={hasPassword ? "Смена пароля" : "Задать пароль"}
          desc={
            hasPassword
              ? "Понадобится текущий пароль."
              : "Вы входите через Google. Можно задать пароль — тогда появится второй способ входа."
          }
        >
          <PasswordForm hasPassword={hasPassword} />
        </Section>

        <Section
          title="Удалить аккаунт"
          desc="Оборвёт вход к профилю. Профиль игрока и статистика в лиге останутся — их ведёт лига."
        >
          <DeleteAccount />
        </Section>
      </div>
    </main>
  );
}
