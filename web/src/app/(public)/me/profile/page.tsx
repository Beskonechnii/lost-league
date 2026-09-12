import Link from "next/link";
import { playerPath } from "@/lib/profiles";
import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/account";
import { lastProfileEdits, type EditField } from "@/lib/profile-edit";
import { AUTH_MAX_W } from "@/components/pouf/blocks";
import { Eyebrow } from "@/components/pouf/text";
import { Breadcrumbs } from "@/components/pouf/breadcrumbs";
import { buttonClasses } from "@/components/pouf/Button";
import { ProfileForm, type FieldReview, type ProfileValues, type Reviews } from "./profile-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Моя анкета" };

// Отдельная страница правки своей анкеты (не вкладка — по решению Q5). Приватная: доступна только
// вошедшему игроку с привязанным профилем; остальных уводим в кабинет, где их развилка (вход/онбординг).

export default async function EditProfilePage() {
  const account = await currentAccount();
  if (!account) redirect("/me");
  if (!account.player) redirect("/me"); // профиля ещё нет — сначала онбординг в /me

  const p = account.player;
  // Ник, город, ссылка и MMR правятся не напрямую, а заявкой в очередь модерации (решение
  // 04.09.2026), поэтому странице нужно знать, чем кончилась последняя заявка по каждому из них:
  // ждёт решения, приняли или вернули с причиной.
  const edits = await lastProfileEdits(p.id, ["nickname", "city", "mmr", "dotabuffUrl", "stratzUrl", "steamUrl"]);
  // Ссылки показываем ровно те, что записаны у игрока, а не выведенные из account_id: иначе человек
  // «сохранял» бы то, чего сам не вводил, и выведенная ссылка навсегда становилась бы его полем.
  const values: ProfileValues = {
    nickname: p.nickname,
    realName: p.realName ?? "",
    city: p.city ?? "",
    country: p.country ?? "",
    birthday: p.birthday ? p.birthday.toISOString().slice(0, 10) : "",
    telegram: p.telegram ?? "",
    // Какая из трёх заполнена — та и показывается: поле одно.
    profileUrl: p.dotabuffUrl ?? p.stratzUrl ?? p.steamUrl ?? "",
    mmr: p.mmr != null ? String(p.mmr) : "",
  };

  // Заявка в работе перекрывает своё поле: вторая на то же поле всё равно не примется
  // (submitProfileEdit её отобьёт), и лучше сказать об этом до отправки, чем после.
  const review = (field: EditField): FieldReview | undefined => {
    const row = edits.get(field);
    if (row?.status === "pending") return { state: "pending", value: row.newValue };
    if (row?.status === "rejected") return { state: "rejected", value: row.newValue, reason: row.notes ?? "" };
    return undefined;
  };
  // Ссылка в форме одна, а колонок под неё три — показываем последнюю по любой из площадок.
  const linkEdit = (["dotabuffUrl", "stratzUrl", "steamUrl"] as const)
    .map((f) => ({ field: f, row: edits.get(f) }))
    .filter((x) => x.row)
    .sort((a, b) => b.row!.id - a.row!.id)[0];

  const reviews: Reviews = {
    nickname: review("nickname"),
    city: review("city"),
    mmr: review("mmr"),
    profileUrl: linkEdit ? review(linkEdit.field) : undefined,
  };

  return (
    <main className="flex-1 px-4 py-10 font-pouf md:py-16">
      <div className={`mx-auto w-full ${AUTH_MAX_W}`}>
        <div className="mb-5 flex items-center justify-between gap-3">
          {/* Крошки, а не «← Кабинет»: путь виден целиком, и он же работает при заходе по прямой
              ссылке, откуда «назад» вело бы наугад (UI-GUIDELINES §3). */}
          <Breadcrumbs items={[{ href: "/me", label: "Кабинет" }]} />
          <Link href={playerPath(p)} className={buttonClasses({ variant: "quiet", size: "sm" })}>
            Моя витрина
          </Link>
        </div>

        <Eyebrow>Кабинет</Eyebrow>
        <h1 className="mt-2 text-[28px] font-black leading-[1.2] tracking-[-0.5px] text-ink">Моя анкета</h1>
        <p className="mb-6 mt-1.5 text-sm font-bold text-muted">
          Эти данные видны на вашей публичной странице в ростере.
        </p>

        <div className="rounded-card bg-surface p-5 cushion-card sm:p-6">
          <ProfileForm values={values} reviews={reviews} />
        </div>
      </div>
    </main>
  );
}
