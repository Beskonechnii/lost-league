import { redirect } from "next/navigation";
import { currentAccount, effectiveRole } from "@/lib/account";
import type { Role } from "@/lib/player-auth";
import { AUTH_MAX_W } from "@/components/pouf/blocks";
import { Alert, StatusPill } from "@/components/pouf/feedback";
import { Eyebrow } from "@/components/pouf/text";
import { Breadcrumbs } from "@/components/pouf/breadcrumbs";
import { playerPath } from "@/lib/profiles";
import { logout } from "../actions";
import { TelegramLink } from "../telegram-link";
import { PasswordForm, DeleteAccount, UnlinkTelegram } from "./security-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Настройки" };

// Настройки аккаунта: кто вошёл, способы входа, пароль, удаление. Доступны любому вошедшему —
// привязка к игроку тут не нужна.
//
// С 04.09.2026 сюда съехала и «карточка аккаунта» из кабинета (имя, роль, выход): у игрока с
// профилем кабинет больше не отдельная страница — `/me` уводит на его страницу в лиге, а всё
// служебное про аккаунт лежит здесь. Прежний адрес `/me/security` остался редиректом.
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

// Роль всегда на виду: владелец и админ несут право писать, игрок — нейтрально.
const ROLE_META: Record<Role, { label: string; tone: "warn" | "info" | "neutral" }> = {
  owner: { label: "Владелец лиги", tone: "warn" },
  admin: { label: "Администратор", tone: "info" },
  player: { label: "Игрок", tone: "neutral" },
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const account = await currentAccount();
  if (!account) redirect("/me");
  const role = ROLE_META[effectiveRole(account)];

  const hasPassword = !!account.passwordHash;
  const hasGoogle = !!account.googleSub;
  const hasTelegram = !!account.tgId;

  return (
    <main className="flex-1 px-4 py-10 font-pouf md:py-16">
      <div className={`mx-auto w-full ${AUTH_MAX_W} space-y-4`}>
        <div>
          {/* Крошки вместо «← Кабинет» — см. UI-GUIDELINES §3. */}
          <Breadcrumbs items={[{ href: account.player ? playerPath(account.player) : "/me", label: account.player ? "Мой профиль" : "Кабинет" }]} />
          <Eyebrow className="mt-4">Аккаунт</Eyebrow>
          <h1 className="mt-2 text-[28px] font-black leading-[1.2] tracking-[-0.5px] text-ink">Настройки</h1>
          {/* Почты может не быть: аккаунт из бота входит по телеграму (BOT-PLAN.md, Э1–Э2). */}
          <p className="mt-1.5 text-sm font-bold text-muted">
            {account.email ?? (account.tgUsername ? `@${account.tgUsername}` : "вход через Telegram")}
          </p>
        </div>

        {/* Кто вошёл. Раньше эта карточка стояла в кабинете; кабинета у игрока с профилем больше
            нет, а «кто я и как отсюда выйти» — вопрос настроек, а не страницы в лиге. */}
        <Section title="Аккаунт">
          <div className="flex items-center gap-3">
            {account.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element -- внешний аватар google, не наш ассет
              <img src={account.avatar} alt="" className="h-12 w-12 rounded-pill object-cover" />
            ) : (
              <span className="grid h-12 w-12 place-items-center rounded-pill bg-accent-fill text-lg font-black text-[var(--on-accent)] cushion-blob">
                {(account.name || account.email || "?").trim().charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              {account.name && <p className="truncate font-black text-ink">{account.name}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusPill tone={role.tone}>{role.label}</StatusPill>
                {account.player && <StatusPill tone="ok">{account.player.nickname}</StatusPill>}
              </div>
            </div>
            <form action={logout}>
              <button type="submit" className="shrink-0 text-xs font-black text-muted transition-colors hover:text-ink">
                Выйти
              </button>
            </form>
          </div>
        </Section>

        <Section title="Способы входа">
          <div className="divide-y divide-hairline">
            <MethodRow label="Google" on={hasGoogle} onText="привязан" offText="не привязан" />
            <MethodRow label="Пароль" on={hasPassword} onText="задан" offText="не задан" />
            <MethodRow label="Telegram" on={hasTelegram} onText="привязан" offText="не привязан" />
            {account.emailVerified && <MethodRow label="Почта" on onText="подтверждена Google" />}
          </div>
        </Section>

        {/* Телеграм — не только способ входа, но и канал лиги: решения по заявке и приглашения в
            состав приходят в этот же чат. Поэтому раздел свой, а не строка в списке выше. */}
        <Section
          title="Телеграм"
          desc="Лига пишет в телеграм: решение по заявке, приглашение в состав, время игры. Привязка идёт через бота — хендл вводить не нужно, телеграм называет вас сам."
        >
          {/* Бот не отозвался на выдачу ссылки — говорим об этом здесь же, у самой кнопки. */}
          {error === "tg-off" && (
            <div className="mb-3">
              <Alert tone="err" block>
                Бот лиги сейчас недоступен — привязать телеграм не выйдет. Попробуйте позже.
              </Alert>
            </div>
          )}
          <TelegramLink linked={hasTelegram} username={account.tgUsername} back="/me/settings" />
          {hasTelegram && <UnlinkTelegram />}
        </Section>

        <Section
          title={hasPassword ? "Смена пароля" : "Задать пароль"}
          desc={
            hasPassword
              ? "Понадобится текущий пароль."
              : "Вы входите через Google. Можно задать пароль — тогда появится второй способ входа."
          }
        >
          {/* Контекст — только для шкалы под полем: она обязана ругаться на то же, на что
              ругнётся сервер, иначе «Надёжный» и отказ противоречат друг другу. */}
          <PasswordForm
            hasPassword={hasPassword}
            context={{ email: account.email ?? undefined, nickname: account.player?.nickname }}
          />
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
