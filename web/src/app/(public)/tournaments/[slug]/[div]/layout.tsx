import { notFound } from "next/navigation";
import { divisionOfTournament } from "@/lib/tournaments";

// Раздел дивизиона внутри турнира: /tournaments/<турнир>/<дивизион>. Турнир в адресе не для красоты —
// имена и слаги дивизионов повторяются из сезона в сезон, и без него «d1» означал бы разное в разные
// годы, а прошлый сезон исчезал бы с витрины при старте нового. Старые /standings/<div>/* остались
// редиректом на текущий турнир, чтобы отданные наружу ссылки не ломались.
//
// От layout'а здесь остался ровно один эффект — цвет дивизиона. Строку навигации и колонку контента
// задаёт layout турнира на уровень выше: этапы (таблица / плей-офф / статистика) — вкладки в ней,
// а не плитки и не «Назад».

export default async function DivisionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; div: string }>;
}) {
  const { slug, div } = await params;
  const division = await divisionOfTournament(slug, div);
  if (!division) notFound();

  // Акцент секции = цвет дивизиона. D1 держит бренд-фиолетовый (дефолт токенов), D2 — бирюзовый
  // с тёмным текстом на плашках. Задаём CSS-переменные на обёртке — весь `accent`-хром внутри
  // (плитки, кнопки, ссылки) перекрашивается сам, без дублирования классов на каждой странице.
  // Значения берём из токенов темы (--lost-d2*), а не литералами — тогда цвет D2 правится в одном
  // месте, на панели /admin/theme, и здесь, и на бренд-хроме.
  const accentVars =
    division.slug === "d2"
      ? ({
          "--accent": "var(--lost-d2, #14c6cb)",
          "--accent-bright": "var(--lost-d2-bright, #5eead4)",
          "--accent-contrast": "var(--lost-d2-contrast, #000000)",
        } as React.CSSProperties)
      : undefined;

  return <div style={accentVars}>{children}</div>;
}
