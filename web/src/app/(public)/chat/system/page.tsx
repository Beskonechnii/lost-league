import Link from "next/link";
import { currentChatMe, findConversation, listConversations, messages } from "@/lib/chat";
import { SYSTEM_NAME, systemAccountId } from "@/lib/system-chat";
import { Icon } from "@/components/pouf/Icon";
import { Breadcrumbs } from "@/components/pouf/breadcrumbs";
import { ConversationList, SystemMark } from "../_components/conversation-list";
import { ChatGate } from "../_components/gate";
import { Thread } from "../_components/thread";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spirit CTRL" };

// Служебный канал лиги. Свой адрес, а не `/chat/<id игрока>`: у собеседника нет профиля в ростере,
// и подставлять ему чужой id было бы враньём. Всё остальное — та же беседа, что у людей: список
// слева, лента справа, непрочитанное и живой канал работают без единой правки (`system-chat.ts`).
//
// Отличий два: писать сюда нельзя (`readOnly`), а у сообщений бывает выбор — «Иду / Не иду» и
// прочее из реестра `chat-actions.ts`. Ответ уходит прямо из ленты.

export default async function SystemChatPage() {
  const me = await currentChatMe();
  if (!me) return <ChatGate />;

  const systemId = await systemAccountId();
  const conversationId = systemId ? await findConversation(me.accountId, systemId) : null;

  const [rows, lines] = await Promise.all([
    listConversations(me.accountId),
    conversationId ? messages(conversationId, me.accountId) : Promise.resolve([]),
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 font-pouf">
      <Breadcrumbs items={[{ href: "/chat", label: "Сообщения" }]} />

      <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="hidden min-h-0 overflow-y-auto lg:block">
          <ConversationList rows={rows} activeSystem />
        </aside>

        <section className="flex min-h-0 w-full max-w-[720px] flex-col gap-4">
          <header className="flex items-center gap-3">
            <SystemMark size={48} />
            <div className="min-w-0">
              <span className="block truncate text-lg font-black text-ink">{SYSTEM_NAME}</span>
              <span className="text-xs font-bold text-muted">Служебный канал лиги</span>
            </div>
            <Link
              href="/chat"
              aria-label="Ко всем беседам"
              className="ml-auto grid h-10 w-10 place-items-center rounded-control bg-surface text-muted cushion-row lg:hidden"
            >
              <Icon name="prev" size="sm" />
            </Link>
          </header>

          <Thread
            conversationId={conversationId}
            peerPlayerId={null}
            peerNickname={SYSTEM_NAME}
            readOnly
            initial={lines.map((l) => ({
              id: l.id,
              text: l.text,
              createdAt: l.createdAt.toISOString(),
              mine: l.mine,
              action: l.action ?? null,
            }))}
          />
        </section>
      </div>
    </div>
  );
}
