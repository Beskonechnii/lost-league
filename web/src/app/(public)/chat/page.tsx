import { currentAccount } from "@/lib/account";
import { chatIdentity, liveIdentity, visibleConversations } from "@/lib/chat";
import { SectionHeader } from "@/components/pouf/blocks";
import { ConversationList } from "./_components/conversation-list";
import { ChatGate } from "./_components/gate";

export const dynamic = "force-dynamic";

// Список бесед. Отдельной страницей, а не только колонкой у переписки: на телефоне это и есть
// экран «Сообщения», а на десктопе — вход, пока конкретная беседа не выбрана.

export default async function ChatIndexPage() {
  const account = await currentAccount();
  const me = liveIdentity(account);
  // Личка — игрокам лиги, но заявителю, которому лига уже написала, список нужен: из служебного
  // канала на телефоне выход ведёт сюда, и упираться в заглушку он не должен. Заглушка остаётся
  // там, где показывать действительно нечего.
  const rows = me ? await visibleConversations(account, me.accountId) : [];
  if (!me || (rows.length === 0 && !chatIdentity(account))) return <ChatGate />;

  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader eyebrow="Лига · переписка" title="Сообщения" aside={<>Личные диалоги игроков лиги</>} />
      <div className="max-w-2xl">
        <ConversationList rows={rows} />
      </div>
    </div>
  );
}
