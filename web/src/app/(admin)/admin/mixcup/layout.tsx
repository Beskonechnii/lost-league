import type { Metadata } from "next";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { denyUnlessPermission } from "../../_components/permission-gate";

// Mix Cup by Eclipse (ТЗ 33) — список турниров этого формата. С ТЗ 37 Mix Cup не отдельная
// сущность, а Tournament(kind: "mixcup"), поэтому и право здесь общее турнирное: консоль обоих
// индивидуальных форматов открывается по `tournaments.edit` (решение Стаса 23.09.2026).

export const metadata: Metadata = {
  title: "Mix Cup by Eclipse",
};

export default async function MixCupLayout({ children }: { children: React.ReactNode }) {
  const denied = await denyUnlessPermission("tournaments.edit", "Mix Cup by Eclipse");
  if (denied) return denied;

  return <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>{children}</main>;
}
