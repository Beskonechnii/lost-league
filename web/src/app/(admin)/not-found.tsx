import { NotFoundView } from "../_components/stub-page";

// То же для служебной части: серия или турнир по несуществующему адресу.

export const metadata = { title: "Страница не найдена" };

export default function AdminNotFound() {
  return <NotFoundView />;
}
