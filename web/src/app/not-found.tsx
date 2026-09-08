import { AppShell } from "./_components/app-shell";
import { NotFoundView } from "./_components/stub-page";

// 404 для адресов, не подошедших ни одной группе маршрутов. Корневой layout навигации не рисует
// (она своя у каждой группы), поэтому колонку сюда приводим руками — иначе экран остаётся без
// единственного способа уйти с него.

export const metadata = { title: "Страница не найдена" };

export default function RootNotFound() {
  return (
    <AppShell>
      <NotFoundView />
    </AppShell>
  );
}
