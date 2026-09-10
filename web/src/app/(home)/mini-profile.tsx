import Link from "next/link";
import type { ReactNode } from "react";
import { accountStatus, effectiveRole, type Account } from "@/lib/account";
import { playerPath } from "@/lib/profiles";
import { buttonClasses } from "@/components/pouf/Button";
import { Icon } from "@/components/pouf/Icon";
import { RankBadge } from "@/components/pouf/rank";
import type { AccountNav } from "@/app/_components/account-nav";

// Первый блок витрины под шапкой: «а я тут кто». Он отвечает на вопрос до того, как человек
// начнёт искать себя в таблицах, и у каждого состояния воронки свой ответ:
//
//   гость              — чем лига полезна и одна дверь внутрь;
//   аккаунт без игрока — что с заявкой (анкета не дописана / ждёт модерации / отказ);
//   игрок лиги         — его карточка в миниатюре: медаль ранга, команда, TP.
//
// Заявку не пересказываем: подробности живут в кабинете (`/me`), тут только строка состояния —
// витрина не должна превращаться во второй кабинет.

/** Общая рамка блока: подушка Кита, заголовок и содержимое. */
function Shell({ children }: { children: ReactNode }) {
  return <section className="rounded-card bg-surface p-5 cushion-card sm:p-6">{children}</section>;
}

/**
 * Строка блока: слева значок с текстом, справа действие. `min-w` у левой части — не украшение:
 * без него на 390px кнопка оставалась в строке, а колонка с текстом ужималась до одного слова
 * в строчку. Теперь при нехватке места переносится кнопка, а не разваливается текст.
 */
function Row({ children, action }: { children: ReactNode; action: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex min-w-[220px] flex-1 items-center gap-4">{children}</div>
      {action}
    </div>
  );
}

/** Плитка факта: цифра сверху, подпись снизу. Мельче `StatTile` — их тут три в ряд на телефоне. */
function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-control bg-surface-2 px-3 py-2.5 cushion-field">
      <div className="text-[15px] font-black tabular-nums text-ink">{value}</div>
      <div className="mt-0.5 text-[11px] font-extrabold uppercase tracking-[1px] text-ink-subtle">{label}</div>
    </div>
  );
}

export function MiniProfile({ account, nav }: { account: Account | null; nav: AccountNav }) {
  const player = account?.player ?? null;

  // ── гость ──────────────────────────────────────────────────────────────────
  if (!account)
    return (
      <Shell>
        <Row
          action={
            <Link href="/me" className={buttonClasses()}>
              Войти или вступить
            </Link>
          }
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-pill bg-accent-fill text-[var(--on-accent)] cushion-blob">
            <Icon name="user" size="md" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[19px] font-black tracking-[-0.3px] text-ink">Вы ещё не в лиге</h2>
            <p className="mt-1 max-w-xl text-sm font-bold leading-[1.5] text-muted">
              Заведите аккаунт — и у вас появится карточка игрока с рангом и статистикой, а команда
              сможет заявить вас в состав на сезон.
            </p>
          </div>
        </Row>
      </Shell>
    );

  // ── оператор без карточки игрока ───────────────────────────────────────────
  // Владельцу и админу звать «подайте заявку» незачем: они в лиге по должности, а не по анкете.
  // Им полезнее вход в свои разделы — с витрины сайдбар снят, и другой дороги туда отсюда нет.
  if (!player && effectiveRole(account) !== "player")
    return (
      <Shell>
        <Row
          action={
            <Link href="/admin" className={buttonClasses({ variant: "quiet" })}>
              Операторская
            </Link>
          }
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-pill bg-surface-2 text-ink-muted cushion-field">
            <Icon name="lab" size="md" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[19px] font-black tracking-[-0.3px] text-ink">{nav.account?.role}</h2>
            <p className="mt-1 max-w-xl text-sm font-bold leading-[1.5] text-muted">
              Карточки игрока у этого аккаунта нет — витрина показывает лигу глазами посетителя.
            </p>
          </div>
        </Row>
      </Shell>
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
      <Shell>
        <Row
          action={
            <Link href="/me" className={buttonClasses({ variant: "quiet" })}>
              {s.action}
            </Link>
          }
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-pill bg-surface-2 text-ink-muted cushion-field">
            <Icon name="clock" size="md" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[19px] font-black tracking-[-0.3px] text-ink">{s.title}</h2>
            <p className="mt-1 max-w-xl text-sm font-bold leading-[1.5] text-muted">{s.text}</p>
          </div>
        </Row>
      </Shell>
    );
  }

  // ── игрок лиги ─────────────────────────────────────────────────────────────
  const photo = nav.account?.photo ?? null;
  const facts: { label: string; value: ReactNode }[] = [];
  if (player.tp > 0) facts.push({ label: "TP", value: player.tp });
  if (player.mmr != null) facts.push({ label: "MMR", value: player.mmr });
  if (nav.spot) facts.push({ label: nav.spot.isCaptain ? "Капитан" : "Команда", value: nav.spot.team.name });

  return (
    <Shell>
      <Row
        action={
          <Link href={playerPath(player)} className={buttonClasses({ variant: "quiet" })}>
            Мой профиль
          </Link>
        }
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- путь из uploads, не next/image-ассет
          <img src={photo} alt="" className="h-14 w-14 shrink-0 rounded-pill object-cover cushion-row" />
        ) : (
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-pill bg-accent-fill text-xl font-black text-[var(--on-accent)] cushion-blob">
            {nav.account?.initials}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[21px] font-black tracking-[-0.4px] text-ink">{player.nickname}</h2>
          <p className="mt-0.5 truncate text-[13px] font-extrabold text-ink-muted">{nav.account?.role}</p>
        </div>
      </Row>

      {(player.rank != null || facts.length > 0) && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {player.rank != null && (
            <span className="rounded-control bg-surface-2 px-3 py-2 cushion-field">
              <RankBadge tier={player.rank} prev={player.rankPrev} size="sm" />
            </span>
          )}
          {facts.map((f) => (
            <Fact key={f.label} label={f.label} value={f.value} />
          ))}
        </div>
      )}
    </Shell>
  );
}
