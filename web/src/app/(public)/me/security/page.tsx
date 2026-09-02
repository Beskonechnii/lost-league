import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/account";
import { AUTH_MAX_W } from "@/components/pouf/blocks";
import { StatusPill } from "@/components/pouf/feedback";
import { Eyebrow } from "@/components/pouf/text";
import { Breadcrumbs } from "@/app/_components/breadcrumbs";
import { PasswordForm, DeleteAccount } from "./security-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Вход и защита" };

// Отдельная приватная страница управления входом (решение Q5): способы входа, пароль, удаление
// аккаунта. Доступна любому вошедшему — привязка к игроку тут не нужна.
//
// Писем в проекте нет, поэтому подтверждать почту тут нечем: строку «Почта» показываем, только
// когда её подтвердил Google (docs/archive/ACCOUNTS-PLAN.md §3).

/** Строка статуса способа входа — как «connected accounts» на привычных сайтах.
 *  Состояние — статус-пилюлей Кита: «привязан» это свойство аккаунта, а не событие. */
function MethodRow({ label, on, onText, offText }: { label: string; on: boolean; onText: string; offText?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm font-bold text-ink">{label}</span>
      <StatusPill tone={on ? "ok" : "neutral"}>{on ? onText : offText}</StatusPill>
    </div>
  );
}

/** Раздел настройки — подушка Кита с заголовком и объяснением, зачем он. */
function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card bg-surface p-5 cushion-card sm:p-6">
      <h2 className="text-[17px] font-black tracking-[-0.2px] text-ink">{title}</h2>
      {desc && <p className="mt-1.5 text-[13px] font-bold leading-[1.5] text-muted">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function SecurityPage() {
  const account = await currentAccount();
  if (!account) redirect("/me");

  const hasPassword = !!account.passwordHash;
  const hasGoogle = !!account.googleSub;

  return (
    <main className="flex-1 px-4 py-10 font-pouf md:py-16">
      <div className={`mx-auto w-full ${AUTH_MAX_W} space-y-4`}>
        <div>
          {/* Крошки вместо «← Кабинет» — см. UI-GUIDELINES §3. */}
          <Breadcrumbs items={[{ href: "/me", label: "Кабинет" }]} />
          <Eyebrow className="mt-4">Аккаунт</Eyebrow>
          <h1 className="mt-2 text-[28px] font-black leading-[1.2] tracking-[-0.5px] text-ink">Вход и защита</h1>
          {/* Почты может не быть: аккаунт из бота входит по телеграму (BOT-PLAN.md, Э1–Э2). */}
          <p className="mt-1.5 text-sm font-bold text-muted">
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
