import type { Metadata } from "next";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { denyUnlessPermission } from "../../_components/permission-gate";

// Fearless draft — драфт героев без повторов по серии. Операторский инструмент эфира,
// живёт в служебной части за правом «tools».
//
// Право и колонка страницы вынесены в layout (как у UNDERBEER): до Э11b обе страницы
// раздела повторяли и гейт, и обёртку `<main>` — а список и борд обязаны стоять в одной
// колонке, иначе при переходе внутрь раздела страница «прыгает».

export const metadata: Metadata = {
  title: "Fearless draft",
};

export default async function FearlessLayout({ children }: { children: React.ReactNode }) {
  const denied = await denyUnlessPermission("tools", "Fearless draft");
  if (denied) return denied;

  return <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>{children}</main>;
}
