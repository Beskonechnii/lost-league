import { notFound } from "next/navigation";
import { heroImg } from "@/lib/assets";
import { localHeroes } from "@/lib/dota-constants";
import { currentViewer, mayEnter, readRoom } from "@/lib/lobby";
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
  const room = await readRoom(id);
  if (!room || !mayEnter(room, viewer)) notFound();

  // Справочник героев нужен борду 15а — он же собирается на админском экране драфта.
  const heroes: HeroRef[] = localHeroes()
    .map((h) => {
      const slug = h.name.replace(/^npc_dota_hero_/, "");
      return { id: h.id, name: h.localized_name, slug, img: heroImg(slug), attr: h.primary_attr };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return <LobbyView initial={room} me={viewer!.accountId} admin={viewer!.admin} heroes={heroes} />;
}
