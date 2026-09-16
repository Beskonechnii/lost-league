import { AppShell } from "../_components/app-shell";

// Своя группа маршрутов у одной страницы — главной. Заводилась под свой хром витрины; с ТЗ 08
// хром у продукта один (`app-shell.tsx`), и группа осталась ради собственных компонентов главной.
// На URL группа не влияет — главная остаётся `/`.
//
// Метаданные корневые (ТЗ 03): у главной заголовок без шаблона — просто «SPIRIT/CTRL».

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
