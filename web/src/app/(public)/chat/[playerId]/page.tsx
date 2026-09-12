import Link from "next/link";
import { playerPath } from "@/lib/profiles";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseId } from "@/lib/api";
import { chatAccountOfPlayer, currentChatMe, findConversation, listConversations, messages } from "@/lib/chat";
import { resolveUpload } from "@/lib/uploads";
import { Icon } from "@/components/pouf/Icon";
import { Breadcrumbs } from "@/components/pouf/breadcrumbs";
import { OnlineDot } from "@/app/_components/chat-live";
import { PlayerAvatar } from "../../roster/_components/avatar";
import { ConversationList } from "../_components/conversation-list";
import { ChatGate } from "../_components/gate";
import { Thread } from "../_components/thread";

export const dynamic = "force-dynamic";

// Беседа с игроком. Адрес — по id игрока, а не беседы: писать начинают из карточки в ростере, где
// известен именно игрок, а беседы может ещё и не быть — она заведётся первым сообщением.

export default async function ChatThreadPage({ params }: { params: Promise<{ playerId: string }> }) {
  const me = await currentChatMe();
  if (!me) return <ChatGate />;

  const playerId = parseId((await params).playerId);
  if (!playerId) notFound();

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { id: true, nickname: true, slug: true, photo: true },
  });
  if (!player) notFound();

  const peerAccount = await chatAccountOfPlayer(playerId);
  const conversationId = peerAccount ? await findConversation(me.accountId, peerAccount.id) : null;

  const [photo, rows, lines] = await Promise.all([
    resolveUpload("players", player.slug, "photo", player.photo),
    listConversations(me.accountId),
    conversationId ? messages(conversationId, me.accountId) : Promise.resolve([]),
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 font-pouf">
      <Breadcrumbs items={[{ href: "/chat", label: "Сообщения" }]} />

      <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Колонка бесед — только на широком экране: на телефоне её роль исполняет /chat. */}
        <aside className="hidden min-h-0 overflow-y-auto lg:block">
          <ConversationList rows={rows} activePlayerId={playerId} />
        </aside>

        {/* Переписка не растягивается на всю ширину витрины: длинная строка в чате читается плохо,
            а реплики и так короткие. Колонка бесед слева от неё остаётся полной. */}
        <section className="flex min-h-0 w-full max-w-[720px] flex-col gap-4">
          <header className="flex items-center gap-3">
            <div className="relative">
              <PlayerAvatar photo={photo} nickname={player.nickname} size={48} className="rounded-xl" />
              <OnlineDot playerId={player.id} className="absolute -bottom-0.5 -right-0.5" />
            </div>
            <div className="min-w-0">
              <Link href={playerPath(player)} className="block truncate text-lg font-black text-ink hover:text-[var(--accent-ink)]">
                {player.nickname}
              </Link>
              <span className="text-xs font-bold text-muted">Личная переписка</span>
            </div>
            <Link
              href="/chat"
              aria-label="Ко всем беседам"
              className="ml-auto grid h-10 w-10 place-items-center rounded-control bg-surface text-muted cushion-row lg:hidden"
            >
              <Icon name="prev" size="sm" />
            </Link>
          </header>

          {peerAccount ? (
            <Thread
              conversationId={conversationId}
              peerPlayerId={player.id}
              peerNickname={player.nickname}
              initial={lines.map((l) => ({ id: l.id, text: l.text, createdAt: l.createdAt.toISOString(), mine: l.mine }))}
            />
          ) : (
            // Профиль в ростере есть, а аккаунта за ним нет: человек в лиге, но на сайт не заходил.
            <p className="rounded-control bg-surface p-4 text-sm font-bold text-muted cushion-row">
              {player.nickname} ещё не заходил на сайт — написать ему нельзя. Как только он войдёт и
              заявку одобрят, переписка откроется.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
