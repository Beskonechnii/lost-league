"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Popover as PopoverPrimitive } from "radix-ui";
import { toast } from "sonner";
import { IconButton } from "@/components/pouf/Button";
import { Icon } from "@/components/pouf/Icon";
import { EmptyState } from "@/components/pouf/feedback";

// Колокольчик витрины — ВИТРИНА СЛУЖЕБНОГО КАНАЛА `/chat/system`, а не второй список сообщений
// (решение 04.09.2026). Строки здесь — те же `ChatMessage` беседы с лигой, что открыты на странице
// канала; своей модели «уведомление» в проекте нет и не заводится.
//
// Отсюда и ограничения: панель только читает (кнопки выбора «Иду / Не иду» остаются в ленте
// канала), группа в ней одна — «Служебные», а личные беседы открываются пунктом «Сообщения» в меню
// аккаунта. Отметка о прочтении — общий `markRead` через `/api/chat/read`: два пути, одно состояние.

export type NotificationLine = {
  id: number;
  text: string;
  /** Время уже подписью: считает сервер, чтобы клиент не расходился с ним на гидрации. */
  time: string;
  unread: boolean;
};

export function Notifications({
  conversationId,
  unread,
  lines,
}: {
  conversationId: number | null;
  unread: number;
  lines: NotificationLine[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function readAll() {
    if (!conversationId || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/chat/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      // Молчащая кнопка — не состояние: счётчик остался как был, и об этом надо сказать.
      toast.error("Не вышло отметить прочитанным");
    }
    setBusy(false);
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? `Уведомления, непрочитанных: ${unread}` : "Уведомления"}
          className="relative grid h-11 w-11 shrink-0 place-items-center rounded-pill bg-surface text-muted transition cushion-row outline-none hover:text-ink focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
        >
          <Icon name="alerts" size="md" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-[19px] min-w-[19px] place-items-center rounded-pill bg-surface px-[5px] text-[10px] font-black tabular-nums text-[var(--color-err-ink)] cushion-row">
              {unread}
            </span>
          )}
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={10}
          collisionPadding={12}
          // 400px из макета, но не шире экрана: на 390 панель прижимается к краям, а не вылезает.
          className="pouf-popover w-[min(400px,calc(100vw-24px))] font-pouf"
        >
          <div className="flex items-center gap-3 border-b border-hairline px-3.5 pb-3 pt-3">
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-black tracking-[-0.2px] text-ink">Уведомления</div>
              <div className="mt-0.5 text-[12px] font-extrabold text-muted">
                {unread > 0 ? `Непрочитанных: ${unread}` : "Всё прочитано"}
              </div>
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={readAll}
                disabled={busy}
                className="shrink-0 text-[12px] font-extrabold text-muted transition hover:text-ink disabled:opacity-50"
              >
                прочитать все
              </button>
            )}
            {/* На 390 панель занимает почти весь экран, и «ткнуть мимо» остаётся полоской 12px:
                явный выход обязателен. */}
            <PopoverPrimitive.Close asChild>
              {/* Тач-цель 44×44: панель на 390 занимает почти весь экран, мимо неё не ткнёшь. */}
              <IconButton
                size="sm"
                variant="quiet"
                label="Закрыть"
                className="!h-11 !w-11"
                icon={<Icon name="close" size="sm" />}
              />
            </PopoverPrimitive.Close>
          </div>

          {lines.length === 0 ? (
            <div className="p-2">
              <EmptyState icon="alerts" title="Пока тихо">
                Лига пишет сюда о заявках, назначенных встречах и решениях оператора.
              </EmptyState>
            </div>
          ) : (
            <>
              <div className="px-3.5 pb-2 pt-3 text-[11px] font-extrabold uppercase tracking-[1.2px] text-ink-subtle">
                Служебные
              </div>
              {/* Длинный список прокручивается внутри панели, а не растягивает её на весь экран. */}
              <div className="max-h-[min(60vh,420px)] space-y-0.5 overflow-y-auto">
                {lines.map((l) => (
                  <div
                    key={l.id}
                    className={`flex gap-3 rounded-blob px-3.5 py-3 ${l.unread ? "bg-surface-2 cushion-field" : ""}`}
                  >
                    <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-chip bg-accent-fill text-[var(--on-accent)] cushion-blob">
                      <Icon name="shield" size="sm" />
                    </span>
                    {/* У служебного сообщения есть только текст и время — заголовка нет, поэтому
                        строка одноуровневая: текст в три строки, дальше многоточие. */}
                    <p className="min-w-0 flex-1 line-clamp-3 text-[12.5px] font-bold leading-[1.45] text-ink">
                      {l.text}
                    </p>
                    <span className="shrink-0 whitespace-nowrap text-[11px] font-extrabold text-ink-subtle">
                      {l.time}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Панель — быстрый просмотр; полная лента и ответы на выбор живут в самом канале. */}
          <div className="mt-1 border-t border-hairline px-3.5 pb-1 pt-3 text-right">
            <Link
              href="/chat/system"
              onClick={() => setOpen(false)}
              className="text-[13px] font-extrabold text-[var(--accent-ink)] hover:underline"
            >
              Служебный канал →
            </Link>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
