import { currentChatMe, listConversations } from "@/lib/chat";
import { SectionHeader } from "@/components/pouf/blocks";
import { ConversationList } from "./_components/conversation-list";
import { ChatGate } from "./_components/gate";

export const dynamic = "force-dynamic";

// Список бесед. Отдельной страницей, а не только колонкой у переписки: на телефоне это и есть
// экран «Сообщения», а на десктопе — вход, пока конкретная беседа не выбрана.

export default async function ChatIndexPage() {
  const me = await currentChatMe();
  if (!me) return <ChatGate />;

  const rows = await listConversations(me.accountId);

  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader eyebrow="Лига · переписка" title="Сообщения" aside={<>Личные диалоги игроков лиги</>} />
      <div className="max-w-2xl">
        <ConversationList rows={rows} />
      </div>
    </div>
  );
}
