import { NotFoundView } from "../_components/stub-page";

// `notFound()` внутри продукта: турнир по чужому слагу, карточка удалённой команды. Колонку рисует
// layout группы — здесь только содержимое.

export const metadata = { title: "Страница не найдена" };

export default function PublicNotFound() {
  return <NotFoundView />;
}
