import Link from "next/link";
import { playerPath } from "@/lib/profiles";
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
import { membersByApplication, type InviteRow } from "@/lib/team-invites";
import { ApplicationSummary } from "@/app/_components/application-summary";
import { denyUnlessPermission } from "../../_components/permission-gate";
import { AdminHeader } from "../../_components/admin-header";
import { EditReviewForms, ReviewForms } from "./review-forms";
import { Alert, EmptyState, StatusPill } from "@/components/pouf/feedback";
import { QueueCard, QueueNote } from "@/components/pouf/queue-card";
import { PillLink } from "@/components/pouf/tabs";
import { Chip, FORM_MAX_W } from "@/components/pouf/blocks";
import { Button } from "@/components/pouf/Button";

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
//
// Все четыре очереди рисует один атом Кита — `QueueCard` (Э9): до него каждая вкладка верстала
// свою карточку, и «принять / вернуть с причиной» выглядело в них по-разному.

const TABS = [
  { key: "profiles", label: "Регистрация профиля" },
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
  const teamMembers = await membersByApplication(teams.map((t) => t.id));
  const tabs = TABS.filter((t) => !("permission" in t) || mayEdit);
  const total = counts.profiles + counts.links + counts.teams + counts.edits;

  return (
    <main className={`mx-auto w-full ${FORM_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <AdminHeader
        title="Модерация"
        aside={total > 0 ? <Chip accent>ждут решения: {total}</Chip> : undefined}
      >
        Всё, что пришло снаружи: анкеты игроков, привязки к профилю и заявки команд на турниры.
        Одобрение заводит профиль в ростере (или привязывает существующий) и открывает кабинет;
        возврат с причиной — анкету можно поправить и прислать снова.
      </AdminHeader>

      {/* Разрез живёт в query, как и везде на сайте: ссылку на нужную вкладку можно кинуть в чат. */}
      <nav className="mt-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <PillLink
            key={t.key}
            href={t.key === "profiles" ? "/admin/moderation" : `/admin/moderation?tab=${t.key}`}
            active={tab === t.key}
            count={counts[t.key]}
          >
            {t.label}
          </PillLink>
        ))}
      </nav>

      <div className="mt-6">
        {tab === "profiles" ? (
          <Registrations queue={queue} />
        ) : tab === "links" ? (
          <Claims claims={claims} />
        ) : tab === "teams" ? (
          <TeamApplications rows={teams} members={teamMembers} />
        ) : (
          <ProfileEdits rows={edits} />
        )}
      </div>
    </main>
  );
}

/** Очередь анкет новых игроков. Привязки сюда не попадают — им своя вкладка. */
function Registrations({ queue }: { queue: PendingRegistration[] }) {
  if (queue.length === 0) {
    return (
      <EmptyState icon="user" title="Новых анкет нет">
        Здесь появятся игроки, заполнившие анкету в кабинете или в боте.
      </EmptyState>
    );
  }
  return (
    <ul className="space-y-3">
      {queue.map((account) => {
        const application = accountApplication(account);
        const sent = account.submittedAt ? dateTime.format(account.submittedAt) : null;
        return (
          <li key={account.id}>
            <QueueCard
              tags={
                <>
                  <StatusPill tone="info">новая анкета</StatusPill>
                  {/* Источник виден сразу: у телеграмной анкеты почты нет вовсе, и пустая колонка
                      иначе выглядела бы поломкой. Связь с человеком у неё — хендл, его и показываем. */}
                  {account.source === "telegram" && <Chip>телеграм</Chip>}
                </>
              }
              title={account.email ?? (account.tgUsername ? `@${account.tgUsername}` : "контакта нет")}
              meta={sent ? `отправлено ${sent}` : undefined}
            >
              {account.name && <p className="font-pouf text-sm font-bold text-muted">{account.name}</p>}
              {application ? (
                <QueueNote>
                  <ApplicationSummary application={application} />
                </QueueNote>
              ) : (
                <Alert tone="err" block>
                  Заявка пустая: анкеты нет. Верните её с причиной.
                </Alert>
              )}
              <ReviewForms accountId={account.id} mmr={application?.mmr ?? null} />
            </QueueCard>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Заявки команд на турниры. Решение по составу принимается на странице турнира (там же замечания,
 * выбор дивизиона и «подтянуть данные»), поэтому здесь — список со ссылкой: раздел модерации
 * отвечает за «не пропустить», а не дублирует разбор.
 */
function TeamApplications({
  rows,
  members,
}: {
  rows: Awaited<ReturnType<typeof pendingApplications>>;
  members: Map<number, InviteRow[]>;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState icon="trophy" title="Заявок команд нет">
        Они появятся, когда у турнира открыт приём и капитан отправит состав.
      </EmptyState>
    );
  }
  return (
    <ul className="space-y-3">
      {rows.map((a) => {
        const draft = parseDraft(a.payload);
        // Согласия игроков — вторая, параллельная ступень: решение не блокируют, но счётчик
        // «подтвердили N из M» отвечает на первый вопрос оператора, не открывая карточку.
        const invited = members.get(a.id) ?? [];
        const accepted = invited.filter((m) => m.status === "accepted").length;
        const declined = invited.filter((m) => m.status === "declined").length;
        return (
          <li key={a.id}>
            <QueueCard
              tags={<Chip>{a.tournament.short ?? a.tournament.name}</Chip>}
              title={draft?.name ?? "заявка"}
              meta={`отправлено ${dateTime.format(a.submittedAt)}`}
            >
              <QueueNote>
                <p className="text-xs">
                  {a.division ? a.division.name : "дивизион не выбран"} · {draft?.players.length ?? 0} игрок(ов)
                  {invited.length > 0 && ` · подтвердили ${accepted} из ${invited.length}`}
                  {declined > 0 && `, отказались ${declined}`}
                </p>
                {draft && (
                  <p className="mt-1 line-clamp-2 text-[11px] text-muted">
                    {draft.players.map((p) => `${p.nickname} (${roleLabel(p.role) ?? "роль не указана"})`).join(", ")}
                  </p>
                )}
              </QueueNote>
              <Link href={`/admin/tournaments/${a.tournament.slug}/registrations`}>
                <Button type="button" size="sm">Разобрать заявку</Button>
              </Link>
            </QueueCard>
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
      <EmptyState icon="user" title="Открытых заявок нет">
        Здесь появятся те, кто вошёл и заявил, что он — такой-то игрок в ростере.
      </EmptyState>
    );
  }
  return (
    <ul className="space-y-3">
      {claims.map((c) => {
        // Аккаунт в pending пришёл из регистрации: одобрение откроет ему кабинет, отказ вернётся к
        // нему причиной. У открытого аккаунта решение касается только самой привязки.
        const waiting = c.status === "pending";
        const sent = c.submittedAt ? dateTime.format(c.submittedAt) : null;
        return (
          <li key={c.id}>
            <QueueCard
              tags={<StatusPill tone="info">{waiting ? "привязка · регистрация" : "привязка"}</StatusPill>}
              title={c.email ?? (c.tgUsername ? `@${c.tgUsername}` : "контакта нет")}
              meta={sent ? `отправлено ${sent}` : undefined}
            >
              {c.name && <p className="font-pouf text-sm font-bold text-muted">{c.name}</p>}
              <QueueNote>
                Заявляет, что он —{" "}
                <Link href={playerPath(c.claim!)} className="font-black text-[var(--accent-ink)] hover:underline">
                  {c.claim!.nickname}
                </Link>
                . Сверьте по профилю: анкеты у этой ветки нет — все данные уже в ростере.
                {waiting && " Одобрение заодно открывает кабинет."}
              </QueueNote>
              {/* mmr не передаём: профиль уже заведён, его цифры апрув не трогает. */}
              <ReviewForms accountId={c.id} link reasonRequired={waiting} />
            </QueueCard>
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
      <EmptyState icon="draft" title="Правок профиля нет">
        Здесь появится то, что игроки меняют у себя в карточке через бота.
      </EmptyState>
    );
  }
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.id}>
          <QueueCard
            tags={
              <>
                <Chip>телеграм</Chip>
                <Chip>{fieldLabel(row.field)}</Chip>
              </>
            }
            title={
              <Link href={playerPath(row.player)} className="hover:text-[var(--accent-ink)]">
                {row.player.nickname}
              </Link>
            }
            meta={`отправлено ${dateTime.format(row.submittedAt)}`}
          >
            <QueueNote>
              {row.field === "photo" ? (
                <div className="flex items-end gap-3">
                  <Photo src={row.oldValue} caption="было" />
                  <Photo src={row.newValue} caption="стало" />
                </div>
              ) : (
                <p className="break-words">
                  <span className="text-muted">{row.oldValue || "пусто"}</span>
                  <span className="px-2 text-muted">→</span>
                  <span className="font-black text-ink">{row.newValue}</span>
                </p>
              )}
            </QueueNote>
            <EditReviewForms editId={row.id} />
          </QueueCard>
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
        <img src={src} alt={caption} className="h-28 w-28 rounded-blob bg-surface object-cover cushion-row" />
      ) : (
        <div className="grid h-28 w-28 place-items-center rounded-blob bg-surface text-xs font-bold text-muted cushion-row">
          нет
        </div>
      )}
      <figcaption className="text-[11px] font-bold text-muted">{caption}</figcaption>
    </figure>
  );
}
