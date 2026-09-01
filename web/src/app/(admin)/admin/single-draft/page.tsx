import { SITE_MAX_W, SectionHeader } from "@/components/pouf/blocks";
import { SingleDraft } from "./_components/single-draft";
import { denyUnlessPermission } from "../../_components/permission-gate";

// Single draft — рандомный герой по каждой характеристике. Живёт в группе (admin), за паролем.
export const metadata = { title: "Single draft — LOST" };

export default async function SingleDraftPage() {
  const denied = await denyUnlessPermission("tools", "Single draft");
  if (denied) return denied;

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <SectionHeader
        eyebrow="Админка"
        title="Single draft"
        aside={<span>По одному случайному герою на каждую характеристику</span>}
      />
      <SingleDraft />
    </main>
  );
}
