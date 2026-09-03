import { redirect } from "next/navigation";

// Список игроков живёт в ростере (`/roster/players`), здесь — только их страницы. Адрес без ключа
// набирают руками, обрезая ссылку до корня, — уводим в список, а не показываем 404.
export default function PlayersIndex() {
  redirect("/roster/players");
}
