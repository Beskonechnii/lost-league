import { READ_MAX_W } from "@/components/pouf/blocks";
import { AdminHeader } from "../../_components/admin-header";
import { SingleDraft } from "./_components/single-draft";
import { denyUnlessPermission } from "../../_components/permission-gate";

// Single draft — рандомный герой по каждой характеристике. Живёт в группе (admin), за паролем.
export const metadata = { title: "Single draft — LOST" };

export default async function SingleDraftPage() {
  const denied = await denyUnlessPermission("tools", "Single draft");
  if (denied) return denied;

  return (
    // Колонка чтения, а не вся ширина сайта: на экране четыре карточки героев, и растянутые
    // на 1600px они превращаются в четыре плаката.
    <main className={`mx-auto w-full ${READ_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <AdminHeader title="Single draft">
        По одному случайному герою на каждую характеристику — сила, ловкость, интеллект, универсал.
        Пул локальный, поэтому «перекрутить» срабатывает мгновенно и не спрашивает сервер.
      </AdminHeader>
      <SingleDraft />
    </main>
  );
}
