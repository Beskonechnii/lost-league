import { SITE_MAX_W } from "../../_components/ui";
import { Breadcrumbs } from "../../_components/breadcrumbs";
import { currentTournament } from "@/lib/tournaments";

// TP — сезонный зачёт очков MVP. Публичная витрина раздела сезона LOST S2 (открывается плиткой
// вкладкой в строке контекста турнира), своих подвкладок нет: страница одна. Правят TP в служебной
// части (/admin/tp).
export default async function TpLayout({ children }: { children: React.ReactNode }) {
  const current = await currentTournament();
  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      {/* TP пока живёт вне адреса турнира (переезд — Э3 в NAV-PLAN), поэтому строки контекста
          у страницы нет и путь показывают крошки. */}
      <Breadcrumbs
        className="mb-4"
        items={[
          { href: "/tournaments", label: "Турниры" },
          ...(current ? [{ href: `/tournaments/${current.slug}`, label: current.name }] : []),
        ]}
      />
      {children}
    </main>
  );
}
