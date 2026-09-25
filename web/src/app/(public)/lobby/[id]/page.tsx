import { notFound } from "next/navigation";
import { heroImg } from "@/lib/assets";
import { localHeroes } from "@/lib/dota-constants";
import { prisma } from "@/lib/prisma";
import { currentViewer, mayEnter, readRoom, roomSecrets, touchLobby } from "@/lib/lobby";
import { lobbyMessages } from "@/lib/lobby-chat";
import type { HeroRef } from "../../../(admin)/admin/fearless-draft/_components/types";
import { LobbyView } from "../_components/room";

export const dynamic = "force-dynamic";

// Комната встречи. Доступ решает МЕМБЕРСТВО, а не право `tools`: участник лобби оператором не
// является. Постороннему и анониму — 404, а не 403 и не редирект на вход: лобби закрытое
// (решение 9), и отказ, отличимый от «такой страницы нет», сам по себе сообщал бы о комнате.

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: `Лобби #${(await params).id}` };
}

export default async function LobbyPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const viewer = await currentViewer();
  // Часы досчитываются ДО чтения: страница, открытая после простоя, обязана показать уже
  // сделанные автоходы, а не ход, истёкший час назад.
  if (viewer) await touchLobby(id);
  const room = await readRoom(id);
  if (!room || !mayEnter(room, viewer)) notFound();

  // Справочник героев нужен борду 15а — он же собирается на админском экране драфта.
  // Историю чата и секреты комнаты читаем ЗДЕСЬ, а не в снимке: снимок один на всех и уходит по
  // живому каналу каждому участнику, а ключ эфира и пароль двери полагаются не каждому.
  const [chat, secrets] = await Promise.all([lobbyMessages(id), roomSecrets(room, viewer!)]);

  // Кого админ комнаты может позвать: все, у кого есть аккаунт и профиль, кроме уже вошедших.
  // Одобренность анкеты не фильтруем: приглашение и есть путь для того, кому список не показан.
  // Список грузим только админу — остальным он не нужен и уезжать в их вкладки не должен.
  const isRoomAdmin = viewer!.admin || room.ownerAccountId === viewer!.accountId;
  const inRoom = new Set(room.members.map((m) => m.playerId));
  const people = isRoomAdmin
    ? (
        await prisma.userAccount.findMany({
          where: { playerId: { not: null } },
          select: { playerId: true, player: { select: { nickname: true } } },
        })
      )
        .filter((a) => !inRoom.has(a.playerId))
        .map((a) => ({ id: a.playerId!, nickname: a.player?.nickname ?? `#${a.playerId}` }))
        .sort((x, y) => x.nickname.localeCompare(y.nickname))
    : [];

  const heroes: HeroRef[] = localHeroes()
    .map((h) => {
      const slug = h.name.replace(/^npc_dota_hero_/, "");
      return { id: h.id, name: h.localized_name, slug, img: heroImg(slug), attr: h.primary_attr };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <LobbyView
      initial={room}
      me={viewer!.accountId}
      admin={viewer!.admin}
      heroes={heroes}
      chat={chat}
      obsKey={secrets.obsKey}
      password={secrets.password}
      people={people}
    />
  );
}
