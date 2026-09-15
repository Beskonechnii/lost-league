"use client";

import { useEffect, useRef, useState } from "react";
import { IconButton } from "@/components/pouf/Button";
import { Icon } from "@/components/pouf/Icon";
import { Card } from "@/components/pouf/surface";
import { Eyebrow } from "@/components/pouf/text";
import { MAX_TEXT } from "@/lib/chat-limits";
import type { LobbyLine, LobbyMemberView } from "@/lib/lobby-room";
import { useChatEvents } from "@/app/_components/chat-live";

/**
 * Чат комнаты: одна лента на всех — обе стороны, тренеры, ОБС и админ комнаты (ТЗ 22в §1).
 *
 * Разметка взята у лички (`chat/_components/thread.tsx`) и отличается ровно одним: разговор
 * групповой, поэтому над чужим пузырём стоит имя автора. Нового атома Кита здесь не заводится —
 * пузырь реплики уже есть.
 *
 * История приезжает с сервера при рендере страницы, дальше лента живёт сама: новое приходит тем же
 * живым каналом, что и снимок комнаты. Опроса нет. Дедуп по id обязателен — своя реплика приходит
 * дважды, ответом на POST и событием канала.
 */
export function LobbyChat({
  lobbyId,
  me,
  members,
  initial,
}: {
  lobbyId: number;
  me: number;
  /** Участники комнаты — по ним подписывается автор реплики: второй раз ник по проводу не гоняем. */
  members: LobbyMemberView[];
  initial: LobbyLine[];
}) {
  const [lines, setLines] = useState<LobbyLine[]>(initial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const append = (line: LobbyLine) =>
    setLines((prev) => (prev.some((l) => l.id === line.id) ? prev : [...prev, line]));

  useChatEvents((event) => {
    if (event.type === "lobby-chat" && event.lobbyId === lobbyId) append(event.line);
  });

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/lobby/${lobbyId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body }),
      });
      const data = (await res.json()) as LobbyLine & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Не отправилось");
        return;
      }
      append(data);
      setText("");
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card variant="tight">
      <div className="flex min-w-0 flex-col gap-3 font-pouf">
        <Eyebrow>Чат комнаты</Eyebrow>

        {/* Лента ограничена по высоте намеренно: разговор не должен уводить борд за экран —
            смотрят в комнате прежде всего на драфт. */}
        <div className="flex max-h-[20rem] min-h-[9rem] flex-col justify-end gap-1 overflow-y-auto rounded-control bg-surface p-3 cushion-row">
          {lines.length === 0 ? (
            <p className="m-auto max-w-sm text-center text-[13px] font-bold text-muted">
              Здесь пусто. Напишите сюда — реплику увидят все, кто в комнате: обе стороны, тренеры,
              ОБС и админ комнаты.
            </p>
          ) : (
            lines.map((line, i) => {
              const mine = line.accountId === me;
              const author = members.find((m) => m.accountId === line.accountId);
              // Подряд идущие реплики одного человека подписываем один раз: имя над каждой
              // строкой в живом споре — три четверти шума.
              const sameAuthor = lines[i - 1]?.accountId === line.accountId;
              return (
                <div key={line.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[min(520px,85%)] rounded-control px-3 py-2 text-sm font-semibold ${
                      mine ? "bg-accent-fill text-[var(--on-accent)]" : "bg-surface-2 text-ink"
                    }`}
                  >
                    {!mine && !sameAuthor && (
                      <span className="mb-0.5 block truncate text-[11px] font-black text-muted">
                        {author?.nickname ?? "Участник"}
                      </span>
                    )}
                    <span className="whitespace-pre-wrap break-words">{line.text}</span>
                    <span
                      className={`ml-2 align-baseline text-[10px] font-bold ${mine ? "opacity-70" : "text-ink-subtle"}`}
                    >
                      {time.format(new Date(line.createdAt))}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottom} />
        </div>

        {/* Поле живёт во всех стадиях — и в сборе, и в драфте, и после: договориться о паузе
            нужно ровно тогда, когда драфт уже идёт. */}
        <div className="flex items-end gap-2 rounded-control bg-surface p-2 pl-3.5 cushion-field focus-within:ring-[3px] focus-within:ring-[var(--focus-ring)]">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            maxLength={MAX_TEXT}
            rows={1}
            placeholder="Реплика в комнату"
            aria-label="Реплика в комнату"
            className="max-h-32 min-h-[40px] flex-1 resize-none border-0 bg-transparent py-2 text-sm font-semibold text-ink outline-none placeholder:text-ink-subtle"
          />
          <IconButton
            label="Отправить"
            icon={<Icon name="send" size="sm" />}
            variant="solid"
            onClick={send}
            disabled={sending || !text.trim()}
          />
        </div>

        {error && <p className="text-[13px] font-bold text-[var(--color-err-ink)]">{error}</p>}
      </div>
    </Card>
  );
}

const time = new Intl.DateTimeFormat("ru", { hour: "2-digit", minute: "2-digit" });
