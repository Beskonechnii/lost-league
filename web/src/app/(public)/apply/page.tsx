import { ComingSoon } from "@/app/_components/coming-soon";

export const metadata = { title: "Заявка на турнир" };

// Общий вход в заявку — вне контекста конкретного турнира. Сама подача устроена per-турнир
// (/tournaments/<slug>/apply, см. TOURNAMENTS-PLAN.md); эта страница — сборный пункт для тех,
// кто пришёл не с карточки турнира, и её ещё предстоит собрать (выбор турнира → редирект).
export default function ApplyPage() {
  return <ComingSoon title="Заявка на турнир" icon="send" />;
}
