import type { Metadata } from "next";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { denyUnlessPermission } from "../../_components/permission-gate";

// Mix Cup by Eclipse (ТЗ 33) — микс-драфт с тумблерами правил и сохранённым результатом.
// Тот же движок, что у UNDERBEER 2.0 (src/lib/draft.ts), но своё право и свой адрес: оператор
// Mix Cup не обязан иметь доступ к UNDERBEER, и наоборот. Служебная часть, публики нет
// (публичная регистрация и секция на главной — docs/tasks/34-mix-cup-registratsiya.md).

export const metadata: Metadata = {
  title: "Mix Cup by Eclipse",
};

export default async function MixCupLayout({ children }: { children: React.ReactNode }) {
  const denied = await denyUnlessPermission("mixcup", "Mix Cup by Eclipse");
  if (denied) return denied;

  return <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>{children}</main>;
}
