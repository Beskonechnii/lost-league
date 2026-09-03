import { permanentRedirect } from "next/navigation";

// Раздел переименован в «Настройки» (04.09.2026) — адрес остаётся живым: он лежит в закладках
// и на него ссылались из кабинета.
export default function LegacySecurityRoute() {
  permanentRedirect("/me/settings");
}
