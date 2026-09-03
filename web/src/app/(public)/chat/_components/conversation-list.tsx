import Link from "next/link";
import type { ConversationRow } from "@/lib/chat";
import { PlayerAvatar } from "../../roster/_components/avatar";
import { OnlineDot } from "@/app/_components/chat-live";

// Колонка бесед. На широком экране стоит слева от переписки, на телефоне — это и есть страница
// /chat, а беседа открывается отдельным экраном: две панели рядом на 375px не живут.

const timeShort = new Intl.DateTimeFormat("ru", { hour: "2-digit", minute: "2-digit" });
const dateShort = new Intl.DateTimeFormat("ru", { day: "numeric", month: "short" });

/** Время у беседы: сегодняшнее — часами, старое — датой. Год не пишем, он тут ничего не решает. */
function when(at: Date): string {
  const now = new Date();
  const sameDay = at.toDateString() === now.toDateString();
  return sameDay ? timeShort.format(at) : dateShort.format(at);
}

export function ConversationList({ rows, activePlayerId }: { rows: ConversationRow[]; activePlayerId?: number }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-control bg-surface p-4 text-sm font-bold text-muted cushion-row">
        Переписки пока нет. Откройте карточку игрока в ростере и нажмите «Написать».
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row) => {
        const active = row.peer.playerId === activePlayerId;
        return (
          <Link
            key={row.id}
            href={`/chat/${row.peer.playerId}`}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-control p-2.5 transition ${
              active ? "bg-accent-fill text-[var(--on-accent)] cushion-blob" : "bg-surface cushion-row hover:cushion-row-hover"
            }`}
          >
            <div className="relative">
              <PlayerAvatar photo={row.peer.photo} nickname={row.peer.nickname} size={44} className="rounded-xl" />
              <OnlineDot playerId={row.peer.playerId} className="absolute -bottom-0.5 -right-0.5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="truncate font-black">{row.peer.nickname}</span>
                <span className={`ml-auto shrink-0 text-[11px] font-bold ${active ? "" : "text-ink-subtle"}`}>
                  {when(row.lastAt)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`truncate text-xs font-bold ${active ? "opacity-80" : "text-muted"}`}>
                  {row.lastMine && row.lastText ? "Вы: " : ""}
                  {row.lastText ?? "нет сообщений"}
                </span>
                {row.unread > 0 && (
                  <span className="ml-auto grid h-[19px] min-w-[19px] shrink-0 place-items-center rounded-pill bg-[var(--down)] px-[5px] text-[10px] font-black text-[var(--color-err-ink)]">
                    {row.unread}
                  </span>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
