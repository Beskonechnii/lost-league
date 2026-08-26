import Link from "next/link";
import { googleConfigured } from "@/lib/google-oauth";
import { currentAccount, linkablePlayers, effectiveRole, accountStatus, accountApplication } from "@/lib/account";
import type { Role } from "@/lib/player-auth";
import { Button } from "@/components/ui/button";
import { ApplicationSummary } from "@/app/_components/application-summary";
import { Onboarding } from "./onboarding";
import { ApplicationFlow } from "./application-form";
import { AuthForms } from "./auth-forms";
import { logout } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Кабинет" };

// Кабинет игрока и единственный вход в систему: логин через Google ИЛИ по email + паролю, привязка
// профиля, его просмотр, а для админов/владельца — дверь в служебную часть. Публичная страница
// (в needsAdmin не значится) — иначе входить было бы некуда.
//
// Что показывать, решает статус воронки (docs/archive/ACCOUNTS-PLAN.md §4): draft/rejected — только анкету
// (пока она не отправлена, аккаунт в лиге ничего не значит), pending — «на рассмотрении»,
// active — полноценный кабинет.

// Даты отправки и решения — одним форматом на весь кабинет.
const dateTime = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

// Тексты сообщений из ?error, которыми google-callback уводит обратно (коды — там же).
const ERRORS: Record<string, string> = {
  off: "Вход через Google не настроен на этом сервере.",
  state: "Сессия входа истекла или не совпала. Попробуйте войти ещё раз.",
  google: "Google не подтвердил вход. Попробуйте ещё раз.",
};

type Account = NonNullable<Awaited<ReturnType<typeof currentAccount>>>;

// Оформление бейджа роли: у каждой роли свой цвет и подпись — роль всегда на виду в карточке.
const ROLE_META: Record<Role, { label: string; cls: string }> = {
  owner: { label: "Владелец лиги", cls: "border-amber-700/60 bg-amber-950/40 text-amber-300" },
  admin: { label: "Администратор", cls: "border-fuchsia-700/60 bg-fuchsia-950/40 text-fuchsia-300" },
  player: { label: "Игрок", cls: "border-sky-800/60 bg-sky-950/40 text-sky-300" },
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const account = await currentAccount();
  const role = account ? effectiveRole(account) : null;
  const status = account ? accountStatus(account) : null;

  return (
    <main className="flex-1 px-4 py-10 md:py-16">
      <div className="mx-auto w-full max-w-md">
        {/* Шапка-марка: делает страницу входа «лицом», а не голой формой */}
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-accent to-fuchsia-600 text-xl font-black text-white shadow-lg shadow-accent/20">
            L
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">Личный кабинет</h1>
          <p className="mt-1 text-sm text-ink-muted">League of Spirits</p>
        </div>

        <div className="rounded-2xl border border-hairline bg-surface-1/60 p-5 shadow-xl shadow-black/20 backdrop-blur">
          {error && ERRORS[error] && (
            <p className="mb-4 rounded-lg border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">{ERRORS[error]}</p>
          )}

          {!account || !role || !status ? (
            <SignedOut />
          ) : status === "active" ? (
            <div className="space-y-4">
              <ProfileCard account={account} role={role} />
              <Link
                href="/me/security"
                className="flex items-center justify-between gap-2 rounded-xl border border-hairline bg-surface-2/40 px-4 py-3 text-sm transition-colors hover:border-accent"
              >
                <span className="text-ink">Вход и защита</span>
                <span className="text-xs text-ink-subtle">пароль, способы входа →</span>
              </Link>
              {role !== "player" && <AdminEntry role={role} />}
              {account.player ? (
                <Linked account={account} />
              ) : account.claim ? (
                <Pending account={account} />
              ) : (
                <Onboarding players={await linkablePlayers()} />
              )}
            </div>
          ) : status === "pending" ? (
            <div className="space-y-4">
              <ProfileCard account={account} role={role} />
              <UnderReview account={account} />
            </div>
          ) : (
            // draft и rejected: кроме анкеты, в кабинете ничего нет — заявку сначала надо отправить
            <div className="space-y-4">
              <ProfileCard account={account} role={role} />
              <ApplicationFlow
                application={accountApplication(account)}
                players={await linkablePlayers()}
                rejectedReason={account.rejectedReason}
                // Дату решения форматируем на сервере: клиент в другом поясе показал бы своё время
                rejectedAt={account.rejectedReason && account.reviewedAt ? dateTime.format(account.reviewedAt) : null}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/** Внутренний профиль пользователя: аватар, имя/почта, бейдж роли, способы входа, выход. */
function ProfileCard({ account, role }: { account: Account; role: Role }) {
  const meta = ROLE_META[role];
  const initial = (account.name || account.email).trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="rounded-xl border border-hairline bg-surface-2/50 p-4">
      <div className="flex items-center gap-3">
        {account.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- внешний аватар google, не наш ассет
          <img src={account.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-accent to-fuchsia-600 text-lg font-bold text-white">
            {initial}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {account.name && <p className="truncate font-semibold">{account.name}</p>}
          <p className="truncate text-sm text-ink-muted">{account.email}</p>
        </div>
        <form action={logout}>
          <button type="submit" className="shrink-0 text-xs text-ink-subtle transition-colors hover:text-ink">
            Выйти
          </button>
        </form>
      </div>

      {/* Роль — обязательно на виду */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}>{meta.label}</span>
        {/* Плашка только у подтверждённой почты: её поднимает лишь Google, а «не подтверждена»
            после отказа от писем ничего не значит — подтверждать нечем */}
        {account.emailVerified && (
          <span className="rounded-full border border-emerald-800/60 bg-emerald-950/30 px-2.5 py-0.5 text-xs text-emerald-400">
            почта подтверждена
          </span>
        )}
      </div>

      {/* Способы входа — как «connected accounts» на привычных сайтах */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-subtle">
        <span>{account.googleSub ? "Google — привязан" : "Google — не привязан"}</span>
        <span>{account.passwordHash ? "Пароль — задан" : "Пароль — не задан"}</span>
      </div>
    </div>
  );
}

/** Плашка входа в служебную часть — видят только owner/admin. */
function AdminEntry({ role }: { role: "owner" | "admin" }) {
  return (
    <Link
      href="/admin"
      className="flex items-center justify-between gap-2 rounded-xl border border-fuchsia-800/70 bg-fuchsia-950/30 px-4 py-3 transition-colors hover:bg-fuchsia-950/50"
    >
      <span>
        <span className="block text-sm font-medium text-fuchsia-100">
          {role === "owner" ? "Вы владелец лиги" : "Вы админ лиги"}
        </span>
        <span className="block text-xs text-fuchsia-300/70">Инструменты, заявки{role === "owner" ? ", роли" : ""}</span>
      </span>
      <span className="shrink-0 text-sm text-fuchsia-300">Открыть →</span>
    </Link>
  );
}

/** Не вошёл: формы email/пароль + кнопка Google. */
function SignedOut() {
  return (
    <div className="space-y-5">
      <AuthForms />

      {googleConfigured() && (
        <>
          <div className="flex items-center gap-3 text-xs text-ink-subtle">
            <span className="h-px flex-1 bg-hairline" />
            или
            <span className="h-px flex-1 bg-hairline" />
          </div>
          <a
            href="/api/auth/google/start"
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-hairline-strong bg-white px-4 py-3 text-sm font-medium text-neutral-800 shadow-sm transition-transform hover:scale-[1.01] active:scale-100"
          >
            <GoogleIcon />
            Войти через Google
          </a>
        </>
      )}
    </div>
  );
}

/** Профиль привязан: показываем его и ведём в ростер. */
function Linked({ account }: { account: Account }) {
  const player = account.player!;
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-emerald-900 bg-emerald-950/30 px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-emerald-400/80">Профиль привязан</p>
        <p className="mt-1 text-lg font-semibold">{player.nickname}</p>
      </div>
      <div className="grid gap-2">
        <Button asChild className="w-full">
          <Link href="/me/profile">Редактировать анкету</Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/roster/players/${player.id}`}>Открыть мой профиль</Link>
        </Button>
      </div>
    </div>
  );
}

/** Аккаунт в pending: заявка отправлена, решения ещё нет. Показываем ровно то, что ушло оператору —
 *  иначе человеку нечего вспомнить, когда заявку вернут с причиной. */
function UnderReview({ account }: { account: Account }) {
  const app = accountApplication(account);
  const sent = account.submittedAt ? dateTime.format(account.submittedAt) : null;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-900 bg-amber-950/30 px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-amber-400/80">Заявка на рассмотрении</p>
        <p className="mt-1 text-sm text-ink-muted">
          {account.claim ? (
            <>
              Вы заявили привязку к профилю <span className="font-semibold text-ink">{account.claim.nickname}</span>.
            </>
          ) : (
            <>
              Анкета отправлена
              {app?.nickname ? (
                <>
                  {" "}
                  под ником <span className="font-semibold text-ink">{app.nickname}</span>
                </>
              ) : null}
              .
            </>
          )}{" "}
          Организатор сверит данные и откроет доступ — до этого в кабинете больше ничего нет.
        </p>
        {sent && <p className="mt-2 text-xs text-ink-subtle">Отправлено {sent}</p>}
      </div>

      {app && (
        <div className="rounded-xl border border-hairline bg-surface-2/40 px-4 py-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-ink-subtle">Что вы отправили</p>
          <ApplicationSummary application={app} />
          <p className="mt-2 text-xs text-ink-subtle">
            Ошиблись в данных? Напишите организатору — он вернёт заявку, и анкету можно будет поправить.
          </p>
        </div>
      )}
    </div>
  );
}

/** Заявка на существующего игрока подана — ждёт оператора. */
function Pending({ account }: { account: Account }) {
  return (
    <div className="rounded-xl border border-amber-900 bg-amber-950/30 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-amber-400/80">Заявка на подтверждении</p>
      <p className="mt-1 text-sm text-ink-muted">
        Вы заявили привязку к профилю <span className="font-semibold text-ink">{account.claim!.nickname}</span>.
        Оператор подтвердит её в админке — после этого профиль появится здесь.
      </p>
    </div>
  );
}

/** Официальный «G» четырёх цветов — узнаваемость кнопки входа. */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}
