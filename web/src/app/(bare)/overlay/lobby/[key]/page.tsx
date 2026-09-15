import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { heroImg } from "@/lib/assets";
import { localHeroes } from "@/lib/dota-constants";
import { readBoard } from "@/lib/lobby";
import type { HeroRef } from "@/app/(admin)/admin/fearless-draft/_components/types";
import { ObsBoard } from "./_components/obs-board";

export const dynamic = "force-dynamic";

// ОБС-вид комнаты встречи: весь борд драфта одним кадром, без хрома сайта (ТЗ 22в §4).
//
// Открывается БЕЗ входа, по неугадываемому ключу: у браузерного источника OBS нет куки, а входить
// в аккаунт внутри OBS перед каждым эфиром — ручная работа на живой трансляции. Решению 9
// («лобби закрытое») это не противоречит: по ключу отдаётся только картинка драфта — ни состава
// комнаты, ни чата, ни кнопок, — и войти по нему в комнату нельзя (решение 12).
//
// Испорченный ключ — 404, как и сама комната постороннему.

export const metadata: Metadata = {
  title: "Драфт — эфир",
  // Источник для трансляции, а не страница для человека: индексировать нечего, а засветить ключ
  // в выдаче — это отдать чужую встречу.
  robots: { index: false, follow: false },
};

export default async function LobbyObsPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const found = await readBoard(key);
  if (!found) notFound();

  // Справочник героев тот же, что на борде капитанов: картинка обязана совпадать с комнатой.
  const heroes: HeroRef[] = localHeroes()
    .map((h) => {
      const slug = h.name.replace(/^npc_dota_hero_/, "");
      return { id: h.id, name: h.localized_name, slug, img: heroImg(slug), attr: h.primary_attr };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return <ObsBoard obsKey={key} initial={found.board} heroes={heroes} />;
}
