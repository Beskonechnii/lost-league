import { HubGroupCards, HubGroupedTiles, type HubGroupCard } from "@/app/_components/hub-tiles";
import { currentPermissions } from "@/lib/account";
import { groupHref, toolGroupsFor } from "@/app/_components/tools";
import { SITE_MAX_W, SectionHeader } from "@/components/pouf/blocks";
import { EmptyState } from "@/components/pouf/feedback";
import { withPlural } from "@/lib/plural";
import { queueBadges } from "./_queues";

export const dynamic = "force-dynamic";
export const metadata = { title: "Админ" };

// Домашняя операторской. Единственный хаб-из-плиток, который стандарт разрешает (UI-GUIDELINES §0,
// принцип 1): он верхний и заодно объясняет инструменты описанием, чего пилюля в баре не может.
// С ТЗ 08 хаб — единственная навигация по инструментам: в баре на него ведёт один пункт «Админ».
//
// С ТЗ 27 верхний экран — входы в группы, а не два десятка плиток: двадцать плиток занимали пять
// экранов подряд, и оператор, которому нужен один инструмент, разбирал их глазами. Плитки уехали
// на страницы групп (`/admin/[group]`), сюда дошли имя группы, её состав строкой и очереди —
// сигнал «есть работа» с хаба не уезжает, ради него сюда и заходят.
//
// H1 — «Админ», а не «Инструменты»: так зовётся одна из групп, и одно слово на два экрана
// нарушает UI-GUIDELINES §9. Заодно совпадает с первой ступенью крошек.

export default async function AdminHome() {
  const perms = await currentPermissions();
  const { counts, words } = await queueBadges(perms);
  const groups = toolGroupsFor(perms);

  // Доступна одна группа — входа не рисуем: клик, за которым нет выбора. Показываем сразу её
  // плитки, как было до ТЗ 27; страница группы по своему адресу продолжает открываться.
  if (groups.length === 1) {
    const only = groups[0];
    return (
      <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
        <HubGroupedTiles
          eyebrow="Служебная часть"
          title="Админ"
          groups={[
            {
              title: only.title,
              tiles: only.tools.map((t) => (counts[t.href] ? { ...t, badge: counts[t.href] } : t)),
            },
          ]}
        />
      </main>
    );
  }

  const cards: HubGroupCard[] = groups.map((g) => ({
    href: groupHref(g),
    title: g.title,
    desc: g.desc,
    icon: g.icon,
    tools: [withPlural(g.tools.length, "инструмент", "инструмента", "инструментов"), ...g.tools.map((t) => t.label)],
    queues: g.tools.map((t) => words[t.href]).filter(Boolean),
  }));

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 font-pouf md:px-6`}>
      <SectionHeader eyebrow="Служебная часть" title="Админ" />
      <div className="mt-8">
        {cards.length > 0 ? (
          <HubGroupCards cards={cards} />
        ) : (
          // Права есть, инструмента под них нет — это пустое СОДЕРЖИМОЕ, а не замечание над ним,
          // поэтому EmptyState, а не Alert.
          <EmptyState icon="lab" title="Инструментов пока нет">
            Роль админа есть, а прав пока нет: попросите владельца лиги отметить нужные разделы в
            «Команде лиги».
          </EmptyState>
        )}
      </div>
    </main>
  );
}
