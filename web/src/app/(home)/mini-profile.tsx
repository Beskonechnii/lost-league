import Link from "next/link";
import type { ReactNode } from "react";
import { accountStatus, effectiveRole, type Account } from "@/lib/account";
import { playerPath } from "@/lib/profiles";
import { roleShort } from "@/lib/roles";
import type { PlayerRecord } from "@/lib/player-record";
import { buttonClasses } from "@/components/pouf/Button";
import { Icon, type IconName } from "@/components/pouf/Icon";
import { StatTile } from "@/components/pouf/blocks";
import { WinrateMeter } from "@/components/pouf/winrate-meter";
import type { AccountNav } from "@/app/_components/account-nav";

// Правая половина верхнего ряда витрины (макет `design/home/Main.dc.html`, карточка 351px):
// «а я тут кто». Карточка отвечает на вопрос до того, как человек начнёт искать себя в таблицах,
// и у каждого состояния воронки свой ответ:
//
//   гость              — чем лига полезна и одна дверь внутрь;
//   аккаунт без игрока — что с заявкой (анкета не дописана / ждёт модерации / отказ);
//   оператор           — вход в его разделы: сайдбара на витрине нет;
//   игрок лиги         — его карточка в миниатюре: MMR, место в зачёте и винрейт за сезон.
//
// Макет рисует два крайних состояния — гостя и игрока лиги; остальные три живут тем же текстом,
// что до переноса, в той же гостевой раскладке (значок, заголовок, объяснение, кнопка). Заявку не
// пересказываем: подробности в кабинете (`/me`), тут только строка состояния.

/** Оболочка карточки: подушка Кита во всю высоту ряда — нижний край вровень с героем. */
function Shell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`flex h-full flex-col gap-[18px] rounded-card bg-surface p-6 font-pouf cushion-card ${className}`}>
      {children}
    </section>
  );
}

/** Состояние-обращение: значок, заголовок, объяснение и одна кнопка. Общее у гостя и воронки. */
function Callout({
  icon,
  title,
  text,
  action,
}: {
  icon: IconName;
  title: string;
  text: string;
  action: { href: string; label: string; quiet?: boolean };
}) {
  return (
    <Shell className="items-center justify-center text-center">
      <span className="grid h-24 w-24 shrink-0 place-items-center rounded-pill bg-accent-fill text-[var(--on-accent)] cushion-control">
        <Icon name={icon} size="lg" />
      </span>
      <h2 className="text-xl font-black tracking-[-0.4px] text-ink">{title}</h2>
      <p className="max-w-[280px] text-[13.5px] font-bold leading-[1.5] text-muted">{text}</p>
      <Link
        href={action.href}
        className={`${buttonClasses({ variant: action.quiet ? "quiet" : "solid", block: true })} mt-auto justify-center`}
      >
        {action.label}
      </Link>
    </Shell>
  );
}

export function MiniProfile({
  account,
  nav,
  record,
  place,
}: {
  account: Account | null;
  nav: AccountNav;
  /** Винрейт за сезон — считает `lib/player-record.ts`; у гостя записи нет. */
  record: PlayerRecord | null;
  /** Место в зачёте TP текущего турнира. Не набрал очков — места нет. */
  place: number | null;
}) {
  const player = account?.player ?? null;

  // ── гость ──────────────────────────────────────────────────────────────────
  if (!account)
    return (
      <Callout
        icon="user"
        title="Войди в аккаунт"
        text="Профиль игрока, статистика сезона и место в рейтинге — после входа."
        action={{ href: "/me", label: "Войти" }}
      />
    );

  // ── оператор без карточки игрока ───────────────────────────────────────────
  // Владельцу и админу звать «подайте заявку» незачем: они в лиге по должности, а не по анкете.
  // Им полезнее вход в свои разделы — с витрины сайдбар снят, и другой дороги туда отсюда нет.
  if (!player && effectiveRole(account) !== "player")
    return (
      <Callout
        icon="lab"
        title={nav.account?.role ?? "Оператор лиги"}
        text="Карточки игрока у этого аккаунта нет — витрина показывает лигу глазами посетителя."
        action={{ href: "/admin", label: "Операторская", quiet: true }}
      />
    );

  // ── аккаунт есть, игрока ещё нет ───────────────────────────────────────────
  if (!player) {
    const status = accountStatus(account);
    const line: Record<typeof status, { title: string; text: string; action: string }> = {
      draft: {
        title: "Анкета не дописана",
        text: "Вернитесь в кабинет и закончите заявку — сохранённый шаг ждёт вас там.",
        action: "Дописать анкету",
      },
      pending: {
        title: "Заявка на модерации",
        text: "Оператор проверяет данные. Как только заявку примут, здесь появится ваша карточка игрока.",
        action: "Открыть кабинет",
      },
      rejected: {
        title: "Заявку отклонили",
        text: "В кабинете написано, почему, — и там же её можно подать заново.",
        action: "Открыть кабинет",
      },
      active: {
        title: "Аккаунт есть, карточки игрока нет",
        text: "Профиль в лиге заводится по заявке — подайте её в кабинете.",
        action: "Открыть кабинет",
      },
    };
    const s = line[status];
    return (
      <Callout icon="clock" title={s.title} text={s.text} action={{ href: "/me", label: s.action, quiet: true }} />
    );
  }

  // ── игрок лиги ─────────────────────────────────────────────────────────────
  const photo = nav.account?.photo ?? null;
  const position = roleShort(nav.spot?.role);

  return (
    <Shell>
      <div className="flex items-center gap-4">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- путь из uploads, не next/image-ассет
          <img src={photo} alt="" className="h-[76px] w-[76px] shrink-0 rounded-pill object-cover cushion-row" />
        ) : (
          <span className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-pill bg-accent-fill text-[26px] font-black text-[var(--on-accent)] cushion-blob">
            {nav.account?.initials}
          </span>
        )}
        <div className="min-w-0">
          <div className="truncate text-[22px] font-black tracking-[-0.5px] text-ink">{player.nickname}</div>
          {nav.spot && <div className="mt-1 truncate text-[13px] font-extrabold text-muted">{nav.spot.team.name}</div>}
          {position && (
            <div className="mt-[5px] truncate text-[11px] font-extrabold uppercase tracking-[0.8px] text-ink-subtle">
              {position}
            </div>
          )}
        </div>
      </div>

      {/* Показателей ровно три: два числа плиткой и винрейт метром. Прочерк вместо пропуска —
          иначе на месте незаполненного MMR карточка каждый раз меняет высоту. */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="MMR" value={player.mmr ?? "—"} />
        <StatTile label="Место в зачёте" value={place ?? "—"} accent />
      </div>

      <WinrateMeter wins={record?.wins ?? 0} losses={record?.losses ?? 0} />

      <Link href={playerPath(player)} className={`${buttonClasses({ variant: "quiet", block: true })} mt-auto justify-center`}>
        Мой профиль
      </Link>
    </Shell>
  );
}
