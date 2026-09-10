import Link from "next/link";
import { accountIdFromSteamId } from "@/lib/profiles";
import { steamConfigured } from "@/lib/steam-oauth";
import {
  linkablePlayers,
  effectiveRole,
  accountStatus,
  accountApplication,
  accountApplicationDraft,
  type Account,
} from "@/lib/account";
import type { Role } from "@/lib/player-auth";
import { StatusPill } from "@/components/pouf/feedback";
import { ApplicationFlow } from "./application-form";
import { Welcome } from "./welcome";
import { logout } from "./actions";

// КАБИНЕТ: всё, что видит ВОШЕДШИЙ. Дверь (формы входа) — в соседнем `door.tsx`; до Э18 оба экрана
// жили одним файлом на 365 строк.
//
// Кому что показывать, решает статус воронки (docs/archive/ACCOUNTS-PLAN.md §4):
//   • заявка ещё не отправлена (draft/rejected) — только анкета: пока её нет, аккаунт в лиге ничего
//     не значит. Сюда же попадает редкий случай «аккаунт открыт, а профиля нет» (владелец по
//     OWNER_EMAIL, снесённый профиль): с Э18 у такого аккаунта тоже один путь — анкета, потому что
//     обходной «завести профиль по нику» убран;
//   • заявка в очереди (pending либо поданная привязка) — welcome-экран;
//   • одобренный игрок сюда не доходит вовсе: `/me` уводит его на страницу в лиге.

/** Дата решения — одним форматом на весь кабинет. */
const dateTime = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

// Роль всегда на виду. Тон — статусной пилюлей Кита: владелец и админ несут право писать
// (предупреждающий и информационный тона), игрок — нейтральный.
const ROLE_META: Record<Role, { label: string; tone: "warn" | "info" | "neutral" }> = {
  owner: { label: "Владелец лиги", tone: "warn" },
  admin: { label: "Администратор", tone: "info" },
  player: { label: "Игрок", tone: "neutral" },
};

/** Ждёт ли аккаунт решения оператора: отправленная анкета либо заявка на привязку. */
const inQueue = (account: Account) => accountStatus(account) === "pending" || !!account.claim;

export async function Cabinet({ account }: { account: Account }) {
  const role = effectiveRole(account);
  const open = accountStatus(account) === "active";

  return (
    <div className="space-y-4">
      <AccountCard account={account} role={role} />
      {open && (
        <>
          <Link
            href="/me/settings"
            className="flex items-center justify-between gap-2 rounded-control bg-surface-2 px-4 py-3.5 text-sm font-black text-ink cushion-field transition hover:text-[var(--accent-ink)]"
          >
            <span>Настройки</span>
            <span className="text-xs font-bold text-muted">пароль, способы входа →</span>
          </Link>
          {role !== "player" && <AdminEntry role={role} />}
        </>
      )}

      {inQueue(account) ? (
        <Welcome account={account} />
      ) : (
        <ApplicationFlow
          application={accountApplication(account)}
          draft={accountApplicationDraft(account)}
          players={await linkablePlayers()}
          // Привязанный Steam — это уже подтверждённый account_id: шаг 2 подставляет его сам,
          // вместо того чтобы просить ссылку. Без ключа в окружении кнопки нет вовсе (как у двери).
          steamAccountId={account.steamId ? accountIdFromSteamId(account.steamId) : null}
          steamAvailable={steamConfigured()}
          rejectedReason={account.rejectedReason}
          // Дату решения форматируем на сервере: клиент в другом поясе показал бы своё время
          rejectedAt={account.rejectedReason && account.reviewedAt ? dateTime.format(account.reviewedAt) : null}
        />
      )}
    </div>
  );
}

/** Ширина колонки: анкета идёт квизом с парами полей — ей нужно шире, чем всему остальному. */
export const cabinetIsWide = (account: Account) => !inQueue(account);

/** Внутренний профиль пользователя: аватар, имя/почта, бейдж роли, способы входа, выход. */
function AccountCard({ account, role }: { account: Account; role: Role }) {
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
