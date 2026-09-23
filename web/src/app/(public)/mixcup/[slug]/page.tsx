import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentAccount, accountStatus } from "@/lib/account";
import { MIXCUP_STATUS_LABELS, MIXCUP_STATUS_TONE, type MixCupStatus } from "@/lib/mixcup";
import { ECLIPSE_PARTNER } from "@/lib/partners";
import { Breadcrumbs } from "@/components/pouf/breadcrumbs";
import { SectionHeader, Chip, FORM_MAX_W } from "@/components/pouf/blocks";
import { Card } from "@/components/pouf/surface";
import { Alert, StatusPill } from "@/components/pouf/feedback";
import { PartnerMark } from "@/components/pouf/media";
import { Button } from "@/components/pouf/Button";
import { joinMixCup, leaveMixCup } from "./actions";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long" });

/** Одна выборка события на запрос — читает и страница, и метаданные (SEO ТЗ 34: второй запрос
 *  под generateMetadata не заводить). */
async function loadEvent(slug: string) {
  return prisma.mixCupEvent.findUnique({ where: { slug } });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) return { title: "Mix Cup не найден", robots: { index: false, follow: false } };

  const name = event.title || `Mix Cup #${event.id}`;
  const status = (event.status in MIXCUP_STATUS_LABELS ? event.status : "open") as MixCupStatus;
  const description =
    status === "open"
      ? `${name} — микс-турнир SPIRIT/CTRL, организатор Eclipse. Приём заявок открыт${
          event.playedAt ? ` до ${dateFmt.format(event.playedAt)}` : ""
        }, записывайся.`
      : status === "done"
        ? `${name} прошёл${event.playedAt ? ` ${dateFmt.format(event.playedAt)}` : ""}. Организатор — Eclipse, лига SPIRIT/CTRL.`
        : `${name} — микс-турнир SPIRIT/CTRL, организатор Eclipse. Приём заявок завершён.`;

  return {
    title: name,
    description,
    alternates: { canonical: `/mixcup/${event.slug}` },
  };
}

export default async function MixCupEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) notFound();

  const status = (event.status in MIXCUP_STATUS_LABELS ? event.status : "open") as MixCupStatus;
  const open = status === "open";
  const name = event.title || `Mix Cup #${event.id}`;

  const account = await currentAccount();
  const registration =
    account &&
    (await prisma.mixCupRegistration.findUnique({
      where: { eventId_accountId: { eventId: event.id, accountId: account.id } },
      select: { id: true },
    }));
  const pendingApplication = account ? accountStatus(account) === "pending" : false;

  return (
    <div className={`mx-auto w-full ${FORM_MAX_W} space-y-6 px-4 py-10 font-pouf md:py-16`}>
      <Breadcrumbs items={[{ href: "/", label: "Главная" }, { href: "/mixcup", label: "Mix Cup" }]} />

      <SectionHeader eyebrow="MIX CUP" title={name} aside={<StatusPill tone={MIXCUP_STATUS_TONE[status]}>{MIXCUP_STATUS_LABELS[status]}</StatusPill>} />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        <Chip>{event.playedAt ? `Когда: ${dateFmt.format(event.playedAt)}` : "Дата уточняется"}</Chip>
        <Chip>Украсть — {event.stealEnabled ? "да" : "нет"}</Chip>
        <Chip>Закрепить — {event.lockEnabled ? "да" : "нет"}</Chip>
      </div>

      <div className="flex items-center gap-2">
        <PartnerMark src={ECLIPSE_PARTNER.src} name={ECLIPSE_PARTNER.name} size="md" />
        <span className="text-xs font-bold text-muted">Организатор</span>
      </div>

      <Card variant="tight">
        <ActionPanel slug={event.slug} open={open} account={account} registered={!!registration} pendingApplication={pendingApplication} />
      </Card>
    </div>
  );
}

/** Панель действия — состояния по таблице DESIGN §3 ТЗ 34: гость/вошедший × открыт/закрыт приём. */
function ActionPanel({
  slug,
  open,
  account,
  registered,
  pendingApplication,
}: {
  slug: string;
  open: boolean;
  account: Awaited<ReturnType<typeof currentAccount>>;
  registered: boolean;
  pendingApplication: boolean;
}) {
  if (!account) {
    return open ? (
      <a href={`/api/mixcup/event/${slug}/intent`} className="inline-flex">
        <Button size="lg">Участвовать</Button>
      </a>
    ) : (
      <Alert tone="warn" block>
        Приём заявок закрыт
      </Alert>
    );
  }

  if (registered) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill tone="ok">Вы записаны</StatusPill>
          {open && (
            <form action={leaveMixCup.bind(null, slug)}>
              <Button type="submit" variant="quiet" tone="down" size="sm">
                Отменить запись
              </Button>
            </form>
          )}
        </div>
        {pendingApplication && (
          <p className="text-xs font-bold text-muted">Анкета на модерации — на участие в Mix Cup это не влияет</p>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <Alert tone="warn" block>
        Приём заявок закрыт
      </Alert>
    );
  }

  return (
    <div className="space-y-2">
      <form action={joinMixCup.bind(null, slug)}>
        <Button type="submit" size="lg">
          Участвовать
        </Button>
      </form>
      {pendingApplication && (
        <p className="text-xs font-bold text-muted">Анкета на модерации — на участие в Mix Cup это не влияет</p>
      )}
    </div>
  );
}
