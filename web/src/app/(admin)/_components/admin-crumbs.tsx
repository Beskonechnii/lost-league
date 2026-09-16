"use client";

import { usePathname } from "next/navigation";
import { Breadcrumbs, type Crumb } from "@/components/pouf/breadcrumbs";
import { groupForPath, groupHref } from "@/app/_components/tools";

/* Крошки служебного экрана: «Админ / <группа> / …».
 *
 * Ступень группы подставляется здесь, а не двадцатью страницами: с ТЗ 27 группа стала
 * экраном, и дописывать её руками в каждый инструмент значит оставить половину без неё —
 * ровно та же причина, по которой шапка подставляет «Админ».
 *
 * Клиентский компонент из-за `usePathname`: адрес — единственный способ узнать, в какой
 * группе мы стоим, а инструменты об этом не знают. Хук держим здесь, а не в `pouf/breadcrumbs`:
 * Кит не должен знать про реестр инструментов, да и публичные страницы с крошками не обязаны
 * ехать в клиентский бандл из-за админки.
 */

const HUB: Crumb = { href: "/admin", label: "Админ" };

export function AdminCrumbs({ crumbs }: { crumbs?: Crumb[] }) {
  const group = groupForPath(usePathname() ?? "");
  return (
    <Breadcrumbs
      items={[HUB, ...(group ? [{ href: groupHref(group), label: group.title }] : []), ...(crumbs ?? [])]}
      className="mb-3"
    />
  );
}
