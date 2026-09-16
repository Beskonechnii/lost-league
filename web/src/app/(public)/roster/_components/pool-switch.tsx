import { PillLink } from "@/components/pouf/tabs";

/**
 * Разрез витрины ростера: одним списком или по турнирам.
 *
 * «Сквозной» — каждая команда и каждый человек ровно одной карточкой, турниры лентой на ней:
 * так видно того, кто идёт из сезона в сезон. «По турнирам» — секция на турнир: так видно состав
 * сезона. Одно другим не заменяется, поэтому это разрез, а не сортировка (решение 04.09.2026).
 *
 * Живёт в адресе (`?by=tournament`), как и остальные разрезы на сайте: ссылку на нужный вид
 * можно кинуть в чат.
 */
export function GroupSwitch({ base, group, extra = "" }: { base: string; group?: string; extra?: string }) {
  const grouped = group === "tournament";
  const join = (params: string) => {
    const all = [extra, params].filter(Boolean).join("&");
    return all ? `${base}?${all}` : base;
  };
  return (
    <div className="flex gap-2">
      <PillLink href={join("")} active={!grouped} size="md">
        Сквозной
      </PillLink>
      <PillLink href={join("by=tournament")} active={grouped} size="md">
        По турнирам
      </PillLink>
    </div>
  );
}
