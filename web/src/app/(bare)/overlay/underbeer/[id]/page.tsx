import { redirect } from "next/navigation";

// Старый адрес оверлея (было общее имя инструмента UNDERBEER на оба инструмента драфта).
// Ссылка могла быть уже вставлена в сцену OBS — не убираем, а уводим на нейтральный /overlay/draft/<id>.
export default async function LegacyOverlayRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/overlay/draft/${id}`);
}
