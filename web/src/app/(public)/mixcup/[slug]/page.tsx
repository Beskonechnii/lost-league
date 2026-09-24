import { redirect } from "next/navigation";

// Старый публичный адрес Mix Cup (ТЗ 34). С ТЗ 37 лицо индивидуального турнира одно — /join/<slug>
// (решение Стаса 23.09.2026), а этот адрес остаётся редиректом: ссылки, розданные в эфире, уже
// разошлись по людям.

export default async function MixCupRedirect({ params }: { params: Promise<{ slug: string }> }) {
  redirect(`/join/${(await params).slug}`);
}
