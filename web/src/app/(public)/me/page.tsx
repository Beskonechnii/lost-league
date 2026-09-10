import Link from "next/link";
import { redirect } from "next/navigation";
import { accountIdFromSteamId, playerPath } from "@/lib/profiles";
import { googleConfigured } from "@/lib/google-oauth";
import { steamConfigured } from "@/lib/steam-oauth";
import {
  currentAccount,
  linkablePlayers,
  effectiveRole,
  accountStatus,
  accountApplication,
  accountApplicationDraft,
} from "@/lib/account";
import type { Role } from "@/lib/player-auth";
import { buttonClasses } from "@/components/pouf/Button";
import { Alert, StatusPill } from "@/components/pouf/feedback";
import { AuthCard, AuthDivider } from "@/components/pouf/auth";
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
//
// Оболочка — `AuthCard` Кита (канонический макет «Вход»), общая со входом по коду из бота: до Э8
// эта страница держала свою тёмную карточку (`bg-surface-1/60 shadow-xl shadow-black/20 backdrop-blur`),
// оставшуюся от прежней темы, а `/login/tg` рядом уже был Light Clay.

// Даты отправки и решения — одним форматом на весь кабинет.
const dateTime = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

// Тексты сообщений из ?error, которыми google-callback уводит обратно (коды — там же).
const ERRORS: Record<string, string> = {
  off: "Этот способ входа не настроен на сервере.",
  state: "Сессия входа истекла или не совпала. Попробуйте войти ещё раз.",
  google: "Google не подтвердил вход. Попробуйте ещё раз.",
  steam: "Steam не подтвердил вход. Попробуйте ещё раз.",
  // Привязка Steam к аккаунту с почтой упёрлась в чужую привязку. Молча пустить в тот аккаунт
  // нельзя — это и был бы вход под чужим именем (steam-callback, случай «занят»).
  "steam-taken": "Этот аккаунт Steam уже привязан к другому профилю лиги.",
};

type Account = NonNullable<Awaited<ReturnType<typeof currentAccount>>>;

// Роль всегда на виду. Тон — статусной пилюлей Кита: владелец и админ несут право писать
// (предупреждающий и информационный тона), игрок — нейтральный.
const ROLE_META: Record<Role, { label: string; tone: "warn" | "info" | "neutral" }> = {
  owner: { label: "Владелец лиги", tone: "warn" },
  admin: { label: "Администратор", tone: "info" },
  player: { label: "Игрок", tone: "neutral" },
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const account = await currentAccount();
  // У одобренного игрока кабинет и профиль — одна и та же страница (решение 04.09.2026): всё, что
  // кабинет показывал про него самого, лежит на его странице в лиге, а служебное про аккаунт —
  // в настройках. Здесь остаётся ровно то, чего на той странице быть не может: вход, анкета,
  // ожидание решения и привязка профиля.
  if (account?.player && accountStatus(account) === "active") redirect(playerPath(account.player));

  const role = account ? effectiveRole(account) : null;
  const status = account ? accountStatus(account) : null;

  const signedOut = !account || !role || !status;
  // Анкета идёт квизом с парами полей — ей нужна колонка пошире, чем окну входа.
  const wide = !signedOut && status !== "active" && status !== "pending";

  return (
    <AuthCard title={signedOut ? "Вход в лигу" : "Личный кабинет"} subtitle="SPIRIT/CTRL" wide={wide}>
      {error && ERRORS[error] && (
        <div className="mb-4">
          <Alert tone="err" block>
            {ERRORS[error]}
          </Alert>
        </div>
      )}

      {signedOut ? (
        <SignedOut />
      ) : status === "active" ? (
        <div className="space-y-4">
          <ProfileCard account={account} role={role} />
          <Link
            href="/me/settings"
            className="flex items-center justify-between gap-2 rounded-control bg-surface-2 px-4 py-3.5 text-sm font-black text-ink cushion-field transition hover:text-[var(--accent-ink)]"
          >
            <span>Настройки</span>
            <span className="text-xs font-bold text-muted">пароль, способы входа →</span>
          </Link>
          {role !== "player" && <AdminEntry role={role} />}
          {/* Сюда доходит только аккаунт без профиля: с профилем страница уводит в лигу выше. */}
          {account.claim ? <Pending account={account} /> : <Onboarding players={await linkablePlayers()} />}
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
            draft={accountApplicationDraft(account)}
            players={await linkablePlayers()}
            // Привязанный Steam — это уже подтверждённый account_id: шаг 2 подставляет его сам,
            // вместо того чтобы просить ссылку. Без ключа в окружении кнопки нет вовсе (как у входа выше).
            steamAccountId={account.steamId ? accountIdFromSteamId(account.steamId) : null}
            steamAvailable={steamConfigured()}
            rejectedReason={account.rejectedReason}
            // Дату решения форматируем на сервере: клиент в другом поясе показал бы своё время
            rejectedAt={account.rejectedReason && account.reviewedAt ? dateTime.format(account.reviewedAt) : null}
          />
        </div>
      )}
    </AuthCard>
  );
}

/** Внутренний профиль пользователя: аватар, имя/почта, бейдж роли, способы входа, выход. */
function ProfileCard({ account, role }: { account: Account; role: Role }) {
  const meta = ROLE_META[role];
  // Почты может не быть вовсе — у пришедшего из бота её не спрашивают (BOT-PLAN.md, Э1).
  const contact = account.email ?? (account.tgUsername ? `@${account.tgUsername}` : null);
  const initial = (account.name || contact || "").trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="rounded-card bg-surface-2 p-4 cushion-field">
      <div className="flex items-center gap-3">
        {account.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- внешний аватар google, не наш ассет
          <img src={account.avatar} alt="" className="h-12 w-12 rounded-pill object-cover" />
        ) : (
          // Монограмма на мятной подушке Кита — тот же приём, что у команды без лого.
          <span className="grid h-12 w-12 place-items-center rounded-pill bg-accent-fill text-lg font-black text-[var(--on-accent)] cushion-blob">
            {initial}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {account.name && <p className="truncate font-black text-ink">{account.name}</p>}
          {contact && <p className="truncate text-[13px] font-bold text-muted">{contact}</p>}
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="shrink-0 text-xs font-black text-muted transition-colors hover:text-ink"
          >
            Выйти
          </button>
        </form>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
        {/* Плашка только у подтверждённой почты: её поднимает лишь Google, а «не подтверждена»
            после отказа от писем ничего не значит — подтверждать нечем */}
        {account.emailVerified && <StatusPill tone="ok">почта подтверждена</StatusPill>}
      </div>

      {/* Способы входа — как «connected accounts» на привычных сайтах */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-muted">
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
      className="flex items-center justify-between gap-2 rounded-control bg-accent-fill px-4 py-3.5 text-[var(--on-accent)] cushion-control transition hover:-translate-y-0.5"
    >
      <span>
        <span className="block text-sm font-black">
          {role === "owner" ? "Вы владелец лиги" : "Вы админ лиги"}
        </span>
        <span className="block text-xs font-bold text-[var(--on-accent-muted)]">
          Инструменты, заявки{role === "owner" ? ", роли" : ""}
        </span>
      </span>
      <span className="shrink-0 text-sm font-black">Открыть →</span>
    </Link>
  );
}

/** Круглая иконочная кнопка соц-входа — ряд из макета «Вход» («или через»). */
function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      title={label}
      aria-label={label}
      className={buttonClasses({ variant: "quiet", size: "lg", shape: "icon", className: "rounded-pill" })}
    >
      {children}
    </a>
  );
}

/** Соц-вход, которого ещё нет: тот же кружок Кита, но приглушённый и с меткой «soon».
 *  Не ссылка намеренно — кнопка, ведущая в тупик, хуже честно погашенной. Подсказку и метку
 *  держит обёртка: сам кружок выключен из событий, поэтому не ловит ни курсор, ни ховер. */
function SocialSoon({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="relative inline-flex" title={`${label} — скоро`}>
      <span
        aria-hidden
        className={buttonClasses({
          variant: "quiet",
          size: "lg",
          shape: "icon",
          className: "pointer-events-none rounded-pill opacity-45",
        })}
      >
        {children}
      </span>
      <span className="pointer-events-none absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-pill bg-surface-2 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.5px] text-muted cushion-field">
        soon
      </span>
      <span className="sr-only">{label} — скоро</span>
    </span>
  );
}

/** Не вошёл: формы email/пароль + соц-входы. */
function SignedOut() {
  return (
    <div>
      <AuthForms />

      {/* Ряд «или через» из макета. Телеграм пока погашен: одним нажатием войти через него нельзя,
          а страница `/login/tg` (вход по коду) требует сперва списаться с ботом — ссылку на неё
          присылает сам бот, так что зарегистрированный через телеграм в кабинет попадёт и без этой
          кнопки. Кружок оживёт на Э19, когда появится привязка через бота (RELEASE-PLAN §E). */}
      <AuthDivider>или через</AuthDivider>
      <div className="flex justify-center gap-3.5">
        {googleConfigured() && (
          <SocialLink href="/api/auth/google/start" label="Войти через Google">
            <GoogleIcon />
          </SocialLink>
        )}
        <SocialSoon label="Вход через Telegram">
          <TelegramIcon />
        </SocialSoon>
        {steamConfigured() && (
          <SocialLink href="/api/auth/steam/start" label="Войти через Steam">
            <SteamIcon />
          </SocialLink>
        )}
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
      <Alert tone="warn" icon="clock" block>
        Заявка на рассмотрении
      </Alert>
      <p className="text-[13px] font-bold leading-[1.5] text-muted">
        {account.claim ? (
          <>
            Вы заявили привязку к профилю <b className="font-black text-ink">{account.claim.nickname}</b>.
          </>
        ) : (
          <>
            Анкета отправлена
            {app?.nickname ? (
              <>
                {" "}
                под ником <b className="font-black text-ink">{app.nickname}</b>
              </>
            ) : null}
            .
          </>
        )}{" "}
        Организатор сверит данные и откроет доступ — до этого в кабинете больше ничего нет.
        {sent && <> Отправлено {sent}.</>}
      </p>

      {app && (
        <div className="rounded-card bg-surface-2 px-4 py-3.5 cushion-field">
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[1px] text-muted">Что вы отправили</p>
          <ApplicationSummary application={app} />
          <p className="mt-3 text-[13px] font-bold leading-[1.45] text-muted">
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
    <div className="space-y-2">
      <Alert tone="warn" icon="clock" block>
        Заявка на подтверждении
      </Alert>
      <p className="text-[13px] font-bold leading-[1.5] text-muted">
        Вы заявили привязку к профилю <b className="font-black text-ink">{account.claim!.nickname}</b>.
        Организатор подтвердит её в админке — после этого профиль появится здесь.
      </p>
    </div>
  );
}

/** Официальный «G» четырёх цветов — узнаваемость кнопки входа. */
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

/** Фирменный самолётик Telegram — пока метка «скоро», вход появится на Э19. */
function TelegramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#229ED9" aria-hidden="true">
      <path d="M21.9 4.34 3.2 11.3c-.9.35-.88 1.64.03 1.93l4.7 1.47 1.8 5.48c.24.72 1.12.9 1.63.35l2.55-2.68 4.66 3.44c.6.44 1.46.11 1.62-.62l3-14.35c.2-.95-.72-1.72-1.6-1.34zM9.7 15.05l-.28 3.9 2.03-2.83 5.6-5.9c.12-.13-.04-.32-.2-.22l-7.15 5.05z" />
    </svg>
  );
}

/** Фирменные шарики Steam — вход по привязанному Steam-аккаунту. */
function SteamIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#171a21" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 15.2 8 16.9" />
      <circle cx="9.4" cy="9.2" r="4" />
      <circle cx="9.4" cy="9.2" r="1.5" fill="#171a21" stroke="none" />
      <circle cx="16.4" cy="14.4" r="2.6" />
    </svg>
  );
}
