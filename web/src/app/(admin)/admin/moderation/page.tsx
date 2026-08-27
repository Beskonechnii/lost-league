import Link from "next/link";
import {
  can,
  pendingClaims,
  pendingRegistrations,
  accountApplication,
  type PendingClaim,
  type PendingRegistration,
} from "@/lib/account";
import { fieldLabel, pendingProfileEdits, type PendingProfileEdit } from "@/lib/profile-edit";
import { parseDraft, pendingApplications } from "@/lib/team-application";
import { roleLabel } from "@/lib/roles";
import { ApplicationSummary } from "@/app/_components/application-summary";
import { denyUnlessPermission } from "../../_components/permission-gate";
import { EditReviewForms, ReviewForms } from "./review-forms";
import { FORM_MAX_W } from "@/app/_components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Модерация" };

// Один раздел на все решения «пускать в лигу»: анкеты новых игроков, привязки к профилю ростера и
// заявки команд на турниры. Раньше это были разные адреса под одним правом — оператор проверял то
// одну страницу, то другую и терял заявки. Теперь вкладки внутри, у каждой число новых; старые
// адреса (/admin/registrations, /admin/claims) редиректят сюда (next.config.ts).
//
// Заявку команды здесь не разбирают: у неё свой экран внутри турнира с замечаниями, выбором
// дивизиона и «подтянуть данные». Вкладка отвечает за «не пропустить» и ведёт туда.
//
// Право accounts.approve: proxy пускает в /admin любого админа, поэтому конкретный раздел закрываем
// здесь. Не право — не ошибка, а плашка: админ, который ведёт архив серий, просто сюда не ходит.

const TABS = [
  { key: "profiles", label: "Регистрация личного профиля" },
  { key: "links", label: "Привязка к профилю" },
  { key: "teams", label: "Заявки команд" },
  // Правки профиля живут под своим правом (roster.edit): это правка ростера, а не решение
  // «пускать в лигу». Без права вкладки нет вовсе — плашка «нельзя» на видном месте только мешает.
  { key: "edits", label: "Правки профиля", permission: "roster.edit" },
] as const;
type TabKey = (typeof TABS)[number]["key"];
const isTab = (v: unknown): v is TabKey => TABS.some((t) => t.key === v);

const dateTime = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function ModerationPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const denied = await denyUnlessPermission("accounts.approve", "Модерация");
  if (denied) return denied;

  const raw = (await searchParams).tab;
  const mayEdit = await can("roster.edit");
  const wanted: TabKey = isTab(raw) ? raw : "profiles";
  const tab: TabKey = wanted === "edits" && !mayEdit ? "profiles" : wanted;
  const [queue, claims, teams, edits] = await Promise.all([
    pendingRegistrations(),
    pendingClaims(),
    pendingApplications(),
    mayEdit ? pendingProfileEdits() : Promise.resolve([]),
  ]);
  const counts: Record<TabKey, number> = {
    profiles: queue.length,
    links: claims.length,
    teams: teams.length,
    edits: edits.length,
  };
  const tabs = TABS.filter((t) => !("permission" in t) || mayEdit);

  return (
    <main className={`mx-auto w-full ${FORM_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-300/80">Служебная часть</p>
      <h1 className="mt-1.5 text-xl font-bold tracking-tight">Модерация</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Всё, что пришло снаружи: анкеты игроков, привязки к профилю и заявки команд на турниры.
        Одобрение заводит профиль в ростере (или привязывает существующий) и открывает кабинет;
        возврат с причиной — анкету можно поправить и прислать снова.
      </p>

      {/* Разрез живёт в query, как и везде на сайте: ссылку на нужную вкладку можно кинуть в чат. */}
      <div className="mt-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "profiles" ? "/admin/moderation" : `/admin/moderation?tab=${t.key}`}
            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
              tab === t.key
                ? "border-accent bg-surface-2 text-ink"
                : "border-hairline bg-surface-1 text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
            {/* Индикатор новых: цветом и числом, чтобы вторая вкладка не терялась из виду. */}
            {counts[t.key] > 0 && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                {counts[t.key]}
              </span>
            )}
          </Link>
        ))}
      </div>

      {tab === "profiles" ? (
        <Registrations queue={queue} />
      ) : tab === "links" ? (
        <Claims claims={claims} />
      ) : tab === "teams" ? (
        <TeamApplications rows={teams} />
      ) : (
        <ProfileEdits rows={edits} />
      )}
    </main>
  );
}

/** Очередь анкет новых игроков. Привязки сюда не попадают — им своя вкладка. */
function Registrations({ queue }: { queue: PendingRegistration[] }) {
  if (queue.length === 0) {
    return (
      <p className="mt-6 rounded-md border border-hairline bg-surface-1 px-3 py-6 text-center text-sm text-ink-subtle">
        Новых заявок нет.
      </p>
    );
  }
  return (
    <ul className="mt-6 space-y-3">
      {queue.map((account) => (
        <li key={account.id} className="rounded-lg border border-hairline bg-surface-1 p-4">
          <Card account={account} />
        </li>
      ))}
    </ul>
  );
}

function Card({ account }: { account: PendingRegistration }) {
  const application = accountApplication(account);
  const sent = account.submittedAt ? dateTime.format(account.submittedAt) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="rounded-md border border-emerald-900 bg-emerald-950/40 px-2 py-0.5 text-xs text-emerald-300">
          новая анкета
        </span>
        {/* Источник виден сразу: у телеграмной анкеты почты нет вовсе, и пустая колонка иначе
            выглядела бы поломкой. Связь с человеком у неё — хендл, его и показываем. */}
        {account.source === "telegram" && (
          <span className="rounded-md border border-sky-900 bg-sky-950/40 px-2 py-0.5 text-xs text-sky-300">
            телеграм
          </span>
        )}
        <span className="min-w-0 truncate text-sm text-ink-muted">
          {account.email ?? (account.tgUsername ? `@${account.tgUsername}` : "контакта нет")}
        </span>
        {account.name && <span className="truncate text-sm text-ink-subtle">· {account.name}</span>}
        {sent && <span className="ml-auto shrink-0 text-xs text-ink-subtle">отправлено {sent}</span>}
      </div>

      {application ? (
        <div className="rounded-md border border-hairline bg-surface-2/40 px-3 py-2">
          <ApplicationSummary application={application} />
        </div>
      ) : (
        <p className="rounded-md border border-rose-900 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
          Заявка пустая: анкеты нет. Верните её с причиной.
        </p>
      )}

      <ReviewForms accountId={account.id} mmr={application?.mmr ?? null} />
    </div>
  );
}

/**
 * Заявки команд на турниры. Решение по составу принимается на странице турнира (там же замечания,
 * выбор дивизиона и «подтянуть данные»), поэтому здесь — список со ссылкой: раздел модерации
 * отвечает за «не пропустить», а не дублирует разбор.
 */
function TeamApplications({ rows }: { rows: Awaited<ReturnType<typeof pendingApplications>> }) {
  if (rows.length === 0) {
    return (
      <p className="mt-6 rounded-md border border-hairline bg-surface-1 px-3 py-6 text-center text-sm text-ink-subtle">
        Заявок команд нет.
      </p>
    );
  }
  return (
    <ul className="mt-6 space-y-2">
      {rows.map((a) => {
        const draft = parseDraft(a.payload);
        return (
          <li key={a.id} className="rounded-lg border border-hairline bg-surface-1 p-4">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="rounded-md border border-sky-900 bg-sky-950/40 px-2 py-0.5 text-xs text-sky-300">
                {a.tournament.short ?? a.tournament.name}
              </span>
              <span className="text-sm font-semibold text-ink">{draft?.name ?? "заявка"}</span>
              <span className="text-xs text-ink-subtle">
                {a.division ? a.division.name : "дивизион не выбран"} · {draft?.players.length ?? 0} игрок(ов)
              </span>
              <span className="ml-auto shrink-0 text-xs text-ink-subtle">
                отправлено {dateTime.format(a.submittedAt)}
              </span>
            </div>
            {draft && (
              <p className="mt-1 line-clamp-2 text-xs text-ink-subtle">
                {draft.players.map((p) => `${p.nickname} (${roleLabel(p.role) ?? "роль не указана"})`).join(", ")}
              </p>
            )}
            <Link
              href={`/admin/tournaments/${a.tournament.slug}/registrations`}
              className="mt-2 inline-block text-xs font-semibold text-accent-bright hover:underline"
            >
              Разобрать заявку →
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Привязка к профилю: человек вошёл и заявил, что он — такой-то в ростере, оператор сверяет.
 * Сюда попадают обе ситуации — заявка из воронки регистрации (аккаунт ждёт решения) и привязка от
 * уже открытого аккаунта: вид заявки один, различаются только последствия решения.
 */
function Claims({ claims }: { claims: PendingClaim[] }) {
  if (claims.length === 0) {
    return (
      <p className="mt-6 rounded-md border border-hairline bg-surface-1 px-3 py-6 text-center text-sm text-ink-subtle">
        Открытых заявок нет.
      </p>
    );
  }
  return (
    <ul className="mt-6 space-y-3">
      {claims.map((c) => {
        // Аккаунт в pending пришёл из регистрации: одобрение откроет ему кабинет, отказ вернётся к
        // нему причиной. У открытого аккаунта решение касается только самой привязки.
        const waiting = c.status === "pending";
        const sent = c.submittedAt ? dateTime.format(c.submittedAt) : null;
        return (
          <li key={c.id} className="space-y-3 rounded-lg border border-hairline bg-surface-1 p-4">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="rounded-md border border-sky-900 bg-sky-950/40 px-2 py-0.5 text-xs text-sky-300">
                {waiting ? "привязка · регистрация" : "привязка"}
              </span>
              <span className="min-w-0 truncate text-sm text-ink-muted">
                {c.email ?? (c.tgUsername ? `@${c.tgUsername}` : "контакта нет")}
              </span>
              {c.name && <span className="truncate text-sm text-ink-subtle">· {c.name}</span>}
              {sent && <span className="ml-auto shrink-0 text-xs text-ink-subtle">отправлено {sent}</span>}
            </div>

            <div className="rounded-md border border-hairline bg-surface-2/40 px-3 py-2 text-sm">
              Заявляет, что он —{" "}
              {/* адрес карточки игрока — числовой id, не slug (см. /roster/players/[id]) */}
              <Link href={`/roster/players/${c.claim!.id}`} className="font-semibold text-accent-bright hover:underline">
                {c.claim!.nickname}
              </Link>
              . Сверьте по профилю: анкеты у этой ветки нет — все данные уже в ростере.
              {waiting && " Одобрение заодно открывает кабинет."}
            </div>

            {/* mmr не передаём: профиль уже заведён, его цифры апрув не трогает. */}
            <ReviewForms accountId={c.id} link reasonRequired={waiting} />
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Правки профиля, присланные игроком из бота (`src/lib/profile-edit.ts`). Разбираются здесь целиком,
 * в отличие от заявок команд: правка — это одно поле, и уводить оператора ради неё на другой экран
 * дороже, чем показать «было → стало» на месте.
 */
function ProfileEdits({ rows }: { rows: PendingProfileEdit[] }) {
  if (rows.length === 0) {
    return (
      <p className="mt-6 rounded-md border border-hairline bg-surface-1 px-3 py-6 text-center text-sm text-ink-subtle">
        Правок профиля нет.
      </p>
    );
  }
  return (
    <ul className="mt-6 space-y-3">
      {rows.map((row) => (
        <li key={row.id} className="space-y-3 rounded-lg border border-hairline bg-surface-1 p-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="rounded-md border border-sky-900 bg-sky-950/40 px-2 py-0.5 text-xs text-sky-300">
              телеграм
            </span>
            {/* адрес карточки игрока — числовой id, не slug (см. /roster/players/[id]) */}
            <Link href={`/roster/players/${row.player.id}`} className="text-sm font-semibold text-accent-bright hover:underline">
              {row.player.nickname}
            </Link>
            <span className="text-sm text-ink-muted">· {fieldLabel(row.field)}</span>
            <span className="ml-auto shrink-0 text-xs text-ink-subtle">отправлено {dateTime.format(row.submittedAt)}</span>
          </div>

          <div className="rounded-md border border-hairline bg-surface-2/40 px-3 py-2 text-sm">
            {row.field === "photo" ? (
              <div className="flex items-end gap-3">
                <Photo src={row.oldValue} caption="было" />
                <Photo src={row.newValue} caption="стало" />
              </div>
            ) : (
              <p className="break-words">
                <span className="text-ink-subtle">{row.oldValue || "пусто"}</span>
                <span className="px-2 text-ink-subtle">→</span>
                <span className="font-semibold text-ink">{row.newValue}</span>
              </p>
            )}
          </div>

          <EditReviewForms editId={row.id} />
        </li>
      ))}
    </ul>
  );
}

/** Портрет «было/стало»: без картинки решение по фото принять нельзя, а размер тут не важен. */
function Photo({ src, caption }: { src: string | null; caption: string }) {
  return (
    <figure className="space-y-1">
      {src ? (
        // локальный файл из public/uploads — оптимизация next/image здесь не нужна
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={caption} className="h-28 w-28 rounded-md border border-hairline object-cover" />
      ) : (
        <div className="grid h-28 w-28 place-items-center rounded-md border border-hairline bg-surface-2 text-xs text-ink-subtle">
          нет
        </div>
      )}
      <figcaption className="text-xs text-ink-subtle">{caption}</figcaption>
    </figure>
  );
}
