import { SubNav } from "../../_components/site-nav";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { denyUnlessPermission } from "../_components/permission-gate";

// Студия — только генерация графики. Профили команд и игроков живут в разделе «Ростер»,
// студия берёт их оттуда как справочник (src/lib/studio-refs.ts).
// Два способа получить картинку: собрать по шаблону из данных лиги или сгенерировать по промту.

const TABS = [
  { href: "/studio/editor", label: "Редактор", hint: "Свободный холст: ручная расстановка элементов" },
  { href: "/studio/generate", label: "Генерация", hint: "Картинки по промту через OpenAI" },
];

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  // Гейт на layout, а не на каждой странице: студия — целый раздел, и платная генерация в нём тоже.
  const denied = await denyUnlessPermission("studio", "Студия");
  if (denied) return denied;

  return (
    <>
      <SubNav items={TABS} />
      <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>{children}</main>
    </>
  );
}
