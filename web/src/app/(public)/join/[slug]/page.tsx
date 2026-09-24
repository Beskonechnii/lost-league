import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentAccount, accountStatus } from "@/lib/account";
import { joinOpen } from "@/lib/mixcup";
import {
  TOURNAMENT_KIND_SHORT,
  TOURNAMENT_STATUS_LABELS,
  type TournamentKind,
  type TournamentStatus,
} from "@/lib/tournaments";
import { ECLIPSE_PARTNER } from "@/lib/partners";
import { ROLES, parseRoleKeys, roleShort, type RoleKey } from "@/lib/roles";
import { Breadcrumbs } from "@/components/pouf/breadcrumbs";
import { SectionHeader, Chip, FORM_MAX_W } from "@/components/pouf/blocks";
import { Capacity } from "@/components/pouf/capacity";
import { Stack } from "@/components/pouf/layout";
import { Card } from "@/components/pouf/surface";
import { Alert, StatusPill } from "@/components/pouf/feedback";
import { PartnerMark } from "@/components/pouf/media";
import { Button } from "@/components/pouf/Button";
import { ChoiceChips } from "@/components/pouf/choice-chips";
import { STATUS_TONE } from "@/app/_components/tournament-status";
import { joinTournament, leaveTournament } from "./actions";

export const dynamic = "force-dynamic";

// Лицо турнира индивидуального формата и форма записи на одном адресе (ТЗ 37, DESIGN §3/§6).
// Не под /tournaments/<slug>: там layout обязательно рисует строку вкладок «Таблица · Плей-офф ·
// Ростер», которых у турнира без дивизионов не существует. Слово адреса называет то, что делает
// пришедший: по ссылке приходят записываться, а не набирать.
//
// /mixcup/<slug> редиректит сюда — уже розданные ссылки на Mix Cup продолжают работать.

const dateFmt = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long" });

/** Одна выборка турнира на запрос — читает и страница, и метаданные (SEO ТЗ 34: второй запрос
 *  под generateMetadata не заводить). */
async function loadTournament(slug: string) {
  return prisma.tournament.findUnique({
    where: { slug },
    include: { draftSettings: true, _count: { select: { registrations: true } } },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const t = await loadTournament(slug);
  if (!t || t.kind === "season") return { title: "Турнир не найден", robots: { index: false, follow: false } };

  const kindName = TOURNAMENT_KIND_SHORT[t.kind as TournamentKind] ?? t.kind;
  const when = t.startAt ? ` ${dateFmt.format(t.startAt)}` : "";
  const description = joinOpen(t)
    ? `${t.name} — ${kindName}, турнир SPIRIT/CTRL для игроков поодиночке. Запись открыта${when ? `, играем${when}` : ""}.`
    : t.status === "finished"
      ? `${t.name} прошёл${when}. ${kindName}, лига SPIRIT/CTRL.`
      : `${t.name} — ${kindName}, турнир SPIRIT/CTRL. Запись завершена.`;

  return { title: t.name, description, alternates: { canonical: `/join/${t.slug}` } };
}

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  // err=roles — отказ записи из-за неотмеченных ролей (ТЗ 38). В адресе, а не в состоянии:
  // панель действия серверная, и заводить клиентскую обёртку ради одной строки ошибки незачем.
  searchParams: Promise<{ err?: string }>;
}) {
  const { slug } = await params;
  const { err } = await searchParams;
  const t = await loadTournament(slug);
  if (!t || t.kind === "season") notFound();

  const open = joinOpen(t);
  const status = (t.status in TOURNAMENT_STATUS_LABELS ? t.status : "draft") as TournamentStatus;
  // Мест не осталось (ТЗ 39). Считаем здесь, а не на сервере записи: форму, которая заведомо
  // ответит отказом, лучше не показывать вовсе — отказ после заполнения это зря потраченный заход.
  const full = t.registrationLimit != null && t._count.registrations >= t.registrationLimit;

  const account = await currentAccount();
  const registration =
    account &&
    (await prisma.tournamentRegistration.findUnique({
      where: { tournamentId_accountId: { tournamentId: t.id, accountId: account.id } },
      select: { id: true, desiredRoles: true },
    }));
  const pendingApplication = account ? accountStatus(account) === "pending" : false;

  return (
    <div className={`mx-auto w-full ${FORM_MAX_W} space-y-6 px-4 py-10 font-pouf md:py-16`}>
      {/* Вторая ступень — «Турниры», а не имя формата: турнир живёт в общем списке, и путь
          должен вести туда, где карточка действительно лежит. */}
      <Breadcrumbs items={[{ href: "/", label: "Главная" }, { href: "/tournaments", label: "Турниры" }]} />

      <SectionHeader
        eyebrow={TOURNAMENT_KIND_SHORT[t.kind as TournamentKind] ?? t.kind}
        title={t.name}
        aside={<StatusPill tone={STATUS_TONE[status]}>{TOURNAMENT_STATUS_LABELS[status]}</StatusPill>}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        <Chip>{t.startAt ? `Когда: ${dateFmt.format(t.startAt)}` : "Дата уточняется"}</Chip>
        <Chip>Украсть — {t.draftSettings?.stealEnabled ?? true ? "да" : "нет"}</Chip>
        <Chip>Закрепить — {t.draftSettings?.lockEnabled ?? true ? "да" : "нет"}</Chip>
      </div>

      {/* Лимит мест (ТЗ 39): задан — «X из N» с полоской и подписью «Мест нет», пусто — просто
          число записавшихся. Тем же атомом, что считает команды в дивизионе. */}
      <Capacity taken={t._count.registrations} limit={t.registrationLimit} unit="players" />

      {/* Знак партнёра — только у формата, у которого он есть. «Организатор: —» не пишем. */}
      {t.kind === "mixcup" && (
        <div className="flex items-center gap-2">
          <PartnerMark src={ECLIPSE_PARTNER.src} name={ECLIPSE_PARTNER.name} size="md" />
          <span className="text-xs font-bold text-muted">Организатор</span>
        </div>
      )}

      <Card variant="tight">
        <ActionPanel
          slug={t.slug}
          open={open}
          full={full}
          account={account}
          roles={registration ? parseRoleKeys(registration.desiredRoles) : null}
          mainRoles={parseRoleKeys(account?.player?.mainRoles)}
          rolesError={err === "roles" ? "Отметьте хотя бы одну роль" : undefined}
          pendingApplication={pendingApplication}
        />
      </Card>
    </div>
  );
}

/**
 * Панель действия — состояния по таблице DESIGN §3 ТЗ 34: гость/вошедший × открыт/закрыт приём.
 * Собрана стопкой: желаемые роли (ТЗ 38) встали строкой выше кнопки, экран не перестраивался.
 */
function ActionPanel({
  slug,
  open,
  full,
  account,
  roles,
  mainRoles,
  rolesError,
  pendingApplication,
}: {
  slug: string;
  open: boolean;
  /** Лимит турнира выбран до конца (ТЗ 39) — записаться больше нельзя, но уже записанный
   *  остаётся записанным и кнопку отмены видит. */
  full: boolean;
  account: Awaited<ReturnType<typeof currentAccount>>;
  /** Отмеченные роли записи; null — аккаунт не записан. */
  roles: RoleKey[] | null;
  /** Основные роли игрока (ТЗ 41) — ими предзаполняется форма записи, пока записи нет. */
  mainRoles: RoleKey[];
  rolesError?: string;
  pendingApplication: boolean;
}) {
  // До 640 кнопка во всю ширину: половинная кнопка под пальцем читается как неактивная.
  const wide = "w-full justify-center sm:w-auto";

  // Почему записаться нельзя — одним текстом на все ветки: закрытый приём и выбранный лимит
  // различаются словами, а не поведением.
  const refusal = !open ? "Запись закрыта" : full ? "Мест не осталось" : null;
  const refusalAlert = (
    <Alert tone="warn" block>
      {refusal}
    </Alert>
  );

  if (!account) {
    return refusal ? (
      refusalAlert
    ) : (
      <a href={`/api/join/${slug}/intent`} className="block sm:inline-flex">
        <Button size="lg" className={wide}>
          Участвовать
        </Button>
      </a>
    );
  }

  if (roles) {
    return (
      <Stack gap={2}>
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill tone="ok">Вы записаны</StatusPill>
          {open && (
            <form action={leaveTournament.bind(null, slug)}>
              <Button type="submit" variant="quiet" tone="down" size="sm">
                Отменить запись
              </Button>
            </form>
          )}
        </div>
        {/* Роли только чтением: отдельного режима правки в 38 нет — поменять значит отменить
            запись и записаться заново, кнопка отмены стоит рядом. */}
        {roles.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {roles.map((r) => (
              <Chip key={r}>{roleShort(r)}</Chip>
            ))}
          </div>
        )}
        {pendingApplication && (
          <p className="text-xs font-bold text-muted">Анкета на модерации — на участие это не влияет</p>
        )}
      </Stack>
    );
  }

  if (refusal) return refusalAlert;

  return (
    <Stack gap={2}>
      <form action={joinTournament.bind(null, slug)} className="space-y-4">
        {/* `max` здесь нет намеренно: на записи ролей сколько угодно (ТЗ 38), лимит анкеты
            сюда не протекает. Предзаполнение — основные роли игрока, если он их называл. */}
        <ChoiceChips
          name="roles"
          label="В каких ролях готовы играть"
          required
          hint={
            mainRoles.length
              ? "Отмечены ваши основные роли — поправьте, если на этом турнире играете иначе"
              : "Можно отметить несколько — капитаны увидят все"
          }
          error={rolesError}
          defaultValue={mainRoles}
          options={ROLES.map((r) => ({ value: r.key, label: r.short }))}
        />
        <Button type="submit" size="lg" className={wide}>
          Участвовать
        </Button>
      </form>
      {pendingApplication && (
        <p className="text-xs font-bold text-muted">Анкета на модерации — на участие это не влияет</p>
      )}
    </Stack>
  );
}
