import { PillLink } from "@/components/pouf/tabs";

// Команды / Игроки — это не раздел, а разрез одной витрины (UI-GUIDELINES §2, L4), поэтому живёт
// в теле страницы рядом с фильтром дивизиона, а не третьим рядом хрома под строкой контекста.
// Раньше здесь был свой SubNav, и на ростере получалось три ряда навигации подряд.

export function RosterSwitch({ slug, current }: { slug: string; current: "teams" | "players" }) {
  const tabs = [
    { key: "teams" as const, label: "Команды" },
    { key: "players" as const, label: "Игроки" },
  ];
  return (
    <div className="flex gap-2">
      {tabs.map((t) => (
        <PillLink key={t.key} href={`/tournaments/${slug}/roster/${t.key}`} active={t.key === current}>
          {t.label}
        </PillLink>
      ))}
    </div>
  );
}
