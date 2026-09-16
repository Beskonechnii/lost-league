import { FORM_MAX_W } from "@/components/pouf/blocks";
import { openForRegistration } from "@/lib/tournaments";
import { readBannerDraft } from "@/lib/home-banner-store";
import { AdminHeader } from "../../_components/admin-header";
import { denyUnlessPermission } from "../../_components/permission-gate";
import { BannerAdmin } from "./_components/banner-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Баннер главной" };

// Экран правки первого экрана лиги. Смысл раздела — снять с разработчика правку афиши: до него
// «повесить на главную другое» стоило правки файла и выкатки.
//
// Ветку по данным считаем здесь же, чтобы форма называла её своим именем: оператору важно знать,
// ЧТО увидит посетитель, пока баннер не заполнен, — иначе «выключить» выглядит как «оставить пусто».

export default async function BannerPage() {
  const denied = await denyUnlessPermission("banner", "Баннер главной");
  if (denied) return denied;

  const [draft, open] = await Promise.all([readBannerDraft(), openForRegistration()]);
  const fallback = open ? `приём заявок в «${open.name}»` : "анонсы следующего сезона";

  return (
    <main className={`mx-auto w-full ${FORM_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <AdminHeader eyebrow="Служебная часть · главная" title="Баннер главной">
        Картинка, заголовок, подпись и кнопка верхнего экрана на «/». Пока заполнены не все поля
        или переключатель выключен, главная показывает герой по данным.
      </AdminHeader>
      <BannerAdmin initial={draft} fallback={fallback} />
    </main>
  );
}
