import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/account";
import { AUTH_MAX_W } from "@/components/pouf/blocks";
import { Eyebrow } from "@/components/pouf/text";
import { Breadcrumbs } from "@/app/_components/breadcrumbs";
import { buttonClasses } from "@/components/pouf/Button";
import { ProfileForm, type ProfileValues } from "./profile-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Моя анкета" };

// Отдельная страница правки своей анкеты (не вкладка — по решению Q5). Приватная: доступна только
// вошедшему игроку с привязанным профилем; остальных уводим в кабинет, где их развилка (вход/онбординг).

export default async function EditProfilePage() {
  const account = await currentAccount();
  if (!account) redirect("/me");
  if (!account.player) redirect("/me"); // профиля ещё нет — сначала онбординг в /me

  const p = account.player;
  // Ссылки показываем ровно те, что записаны у игрока, а не выведенные из account_id: иначе человек
  // «сохранял» бы то, чего сам не вводил, и выведенная ссылка навсегда становилась бы его полем.
  const values: ProfileValues = {
    nickname: p.nickname,
    realName: p.realName ?? "",
    city: p.city ?? "",
    country: p.country ?? "",
    birthday: p.birthday ? p.birthday.toISOString().slice(0, 10) : "",
    telegram: p.telegram ?? "",
    dotabuffUrl: p.dotabuffUrl ?? "",
    stratzUrl: p.stratzUrl ?? "",
    steamUrl: p.steamUrl ?? "",
    achievements: p.achievements ?? "",
  };

  return (
    <main className="flex-1 px-4 py-10 font-pouf md:py-16">
      <div className={`mx-auto w-full ${AUTH_MAX_W}`}>
        <div className="mb-5 flex items-center justify-between gap-3">
          {/* Крошки, а не «← Кабинет»: путь виден целиком, и он же работает при заходе по прямой
              ссылке, откуда «назад» вело бы наугад (UI-GUIDELINES §3). */}
          <Breadcrumbs items={[{ href: "/me", label: "Кабинет" }]} />
          <Link href={`/roster/players/${p.id}`} className={buttonClasses({ variant: "quiet", size: "sm" })}>
            Моя витрина
          </Link>
        </div>

        <Eyebrow>Кабинет</Eyebrow>
        <h1 className="mt-2 text-[28px] font-black leading-[1.2] tracking-[-0.5px] text-ink">Моя анкета</h1>
        <p className="mb-6 mt-1.5 text-sm font-bold text-muted">
          Эти данные видны на вашей публичной странице в ростере.
        </p>

        <div className="rounded-card bg-surface p-5 cushion-card sm:p-6">
          <ProfileForm values={values} />
        </div>
      </div>
    </main>
  );
}
