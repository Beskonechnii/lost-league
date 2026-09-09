import type { ReactNode } from "react";
import { profileLinkKind, type Application } from "@/lib/application";
import { roleLabel } from "@/lib/roles";

// Анкета-заявка в читаемом виде. Одна разметка на две стороны: карточку в очереди модерации
// («что человек о себе написал») и кабинет («вот что вы отправили»). Разъехавшись, эти два экрана
// показывали бы разные срезы одних и тех же данных, и спорить о заявке было бы не о чем.

/** Дата рождения из анкеты (yyyy-mm-dd) по-русски. Полдень — чтобы часовой пояс не сдвинул день. */
function humanBirthday(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

/** Подпись строки со ссылкой — по площадке, которую дал человек. */
const LINK_LABEL = { dotabuff: "Dotabuff", stratz: "Stratz", steam: "Steam" } as const;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-0.5 py-1">
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-ink">{children}</dd>
    </div>
  );
}

/** Ссылка на профиль: показываем адрес целиком — оператор по нему и опознаёт человека. */
function LinkRow({ label, url }: { label: string; url: string }) {
  return (
    <Row label={label}>
      <a href={url} target="_blank" rel="noreferrer" className="break-all text-accent-bright hover:underline">
        {url}
      </a>
    </Row>
  );
}

export function ApplicationSummary({ application: app }: { application: Application }) {
  const place = [app.city, app.country].filter(Boolean).join(", ");

  return (
    <dl className="divide-y divide-hairline/60">
      <Row label="Ник">
        <span className="font-semibold">{app.nickname}</span>
      </Row>
      {/* Имя и фамилия — одной строкой: в анкете это два поля, а в сводке они читаются как одно. */}
      {app.realName && <Row label="Имя">{[app.realName, app.realSurname].filter(Boolean).join(" ")}</Row>}
      {app.birthday && <Row label="Дата рождения">{humanBirthday(app.birthday)}</Row>}
      {place && <Row label="Откуда">{place}</Row>}
      {app.position && <Row label="Позиция">{roleLabel(app.position) ?? app.position}</Row>}
      {app.mmr != null && (
        <Row label="MMR">
          {app.mmr} <span className="text-xs text-ink-subtle">со слов игрока</span>
        </Row>
      )}
      {app.profileUrl && <LinkRow label={LINK_LABEL[profileLinkKind(app.profileUrl) ?? "dotabuff"]} url={app.profileUrl} />}
      {app.telegram && (
        <Row label="Telegram">
          <a
            href={`https://t.me/${app.telegram}`}
            target="_blank"
            rel="noreferrer"
            className="text-accent-bright hover:underline"
          >
            @{app.telegram}
          </a>
        </Row>
      )}
    </dl>
  );
}
