import Link from "next/link";
import type { ReactNode } from "react";
import { accountApplication, type Account } from "@/lib/account";
import { openForRegistration } from "@/lib/tournaments";
import { roleLabel } from "@/lib/roles";
import { Alert, StatusPill } from "@/components/pouf/feedback";
import { ApplicationSummary } from "@/app/_components/application-summary";

// WELCOME: экран сразу после отправки анкеты (и всё время, пока заявка ждёт решения).
//
// Зачем он такой. Раньше на этом месте была одна плашка «Заявка на рассмотрении» и сводка полей —
// человек отправлял анкету и попадал в тупик: непонятно, кем он в лиге стал, сколько ждать и можно
// ли что-то делать дальше. Теперь экран отвечает на три вопроса подряд: КТО я тут (мини-профиль —
// то, чем человек станет в лиге), ЧТО с заявкой (подушка «на модерации»), ЧТО МОЖНО УЖЕ СЕЙЧАС.
//
// Список «уже сейчас» намеренно честный: в нём только то, что правда работает до апрува. Заявка
// команды в турнир работает (её подаёт любой вошедший — решение 23.08.2026, см. tournaments/[slug]
// /apply/actions.ts), настройки аккаунта тоже. Фото и баннер — НЕТ: своей загрузки картинок у
// игрока в проекте пока нет вовсе (`/api/roster/upload` под правом `roster.edit`), поэтому они
// стоят строкой «после одобрения», а не ссылкой в никуда.

/** Дата отправки — тем же форматом, что и остальные даты кабинета. */
const dateTime = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

/** Мини-профиль: как человек будет выглядеть в лиге, когда заявку примут. */
function MiniProfile({
  nickname,
  fullName,
  photo,
  facts,
}: {
  nickname: string;
  fullName: string | null;
  photo: string | null;
  facts: string[];
}) {
  const initial = nickname.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="rounded-card bg-surface-2 p-4 cushion-field">
      <div className="flex items-center gap-3">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- путь из uploads, не next/image-ассет
          <img src={photo} alt="" className="h-14 w-14 rounded-pill object-cover" />
        ) : (
          // Монограмма на мятной подушке Кита — тот же приём, что у команды без лого.
          <span className="grid h-14 w-14 place-items-center rounded-pill bg-accent-fill text-xl font-black text-[var(--on-accent)] cushion-blob">
            {initial}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-black tracking-[-0.2px] text-ink">{nickname}</p>
          {fullName && <p className="truncate text-[13px] font-bold text-muted">{fullName}</p>}
        </div>
      </div>
      {facts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {facts.map((f) => (
            <StatusPill key={f} tone="neutral">
              {f}
            </StatusPill>
          ))}
        </div>
      )}
    </div>
  );
}

/** Строка «что можно уже сейчас»: ссылка — если можно, приглушённая строка с меткой — если ещё нет. */
function NextStep({
  title,
  hint,
  href,
  later,
}: {
  title: string;
  hint: ReactNode;
  href?: string;
  /** Метка вместо стрелки: действие откроется только после решения оператора. */
  later?: string;
}) {
  const body = (
    <>
      <span className="min-w-0">
        <span className="block text-sm font-black text-ink">{title}</span>
        <span className="mt-0.5 block text-[13px] font-bold leading-[1.45] text-muted">{hint}</span>
      </span>
      <span className="shrink-0 text-xs font-black text-muted">{later ?? "→"}</span>
    </>
  );
  const shell = "flex items-center justify-between gap-3 rounded-control bg-surface-2 px-4 py-3 cushion-field";
  return href ? (
    <Link href={href} className={`${shell} transition hover:text-[var(--accent-ink)]`}>
      {body}
    </Link>
  ) : (
    <div className={`${shell} opacity-70`}>{body}</div>
  );
}

/**
 * Экран ожидания. Обе ветки воронки приходят сюда: «я новый игрок» (анкета JSON) и «я уже участник
 * лиги» (заявка на привязку) — разница только в том, откуда берётся мини-профиль.
 */
export async function Welcome({ account }: { account: Account }) {
  const app = accountApplication(account);
  const claimed = account.claim;
  const sent = account.submittedAt ? dateTime.format(account.submittedAt) : null;
  // Куда звать заявляться командой: приём идёт не у «текущего» турнира, а у следующего.
  const tournament = await openForRegistration();

  const nickname = claimed?.nickname ?? app?.nickname ?? account.name ?? "Новый игрок";
  const fullName =
    [claimed?.realName ?? app?.realName, claimed?.realSurname ?? app?.realSurname].filter(Boolean).join(" ") || null;

  // Факты мини-профиля — только заполненные: пустые плашки «— позиция» ничего не сообщают.
  const facts = [
    roleLabel(app?.position),
    [claimed?.city ?? app?.city, claimed?.country ?? app?.country].filter(Boolean).join(", ") || null,
    (claimed?.mmr ?? app?.mmr) != null ? `${claimed?.mmr ?? app?.mmr} MMR` : null,
  ].filter((f): f is string => !!f);

  return (
    <div className="space-y-4">
      <MiniProfile nickname={nickname} fullName={fullName} photo={claimed?.photo ?? null} facts={facts} />

      <div className="space-y-2">
        <Alert tone="warn" icon="clock" block>
          Заявка на модерации
        </Alert>
        <p className="text-[13px] font-bold leading-[1.5] text-muted">
          {claimed ? (
            <>
              Вы заявили привязку к профилю <b className="font-black text-ink">{claimed.nickname}</b>. Организатор
              сверит данные и откроет доступ — тогда страница в лиге станет вашей.
            </>
          ) : (
            <>Организатор сверит анкету и откроет доступ — тогда у вас появится страница в лиге.</>
          )}
          {sent && <> Отправлено {sent}.</>}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-extrabold uppercase tracking-[1px] text-muted">Что можно уже сейчас</p>
        <NextStep
          title="Заявить команду в турнир"
          hint={
            tournament
              ? `Приём заявок в «${tournament.name}» открыт — состав подаёт капитан.`
              : "Приём заявок сейчас закрыт — сроки ближайшего турнира на его странице."
          }
          href={tournament ? `/tournaments/${tournament.slug}/apply` : "/tournaments"}
        />
        <NextStep
          title="Настроить вход"
          hint="Пароль, Google и Steam — чтобы не потерять аккаунт."
          href="/me/settings"
        />
        <NextStep
          title="Фото и баннер профиля"
          hint="Появятся вместе со страницей в лиге — загрузить их пока некуда."
          later="после одобрения"
        />
      </div>

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
