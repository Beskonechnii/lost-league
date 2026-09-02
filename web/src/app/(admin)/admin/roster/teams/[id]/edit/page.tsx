import { notFound } from "next/navigation";
import { getTeam } from "@/lib/roster-data";
import { TeamEditor } from "@/app/_components/roster-editors";
import { FORM_MAX_W } from "@/components/pouf/blocks";
import { denyUnlessPermission } from "../../../../../_components/permission-gate";
import { AdminHeader } from "../../../../../_components/admin-header";

export const dynamic = "force-dynamic";

// Как и у игрока: страница команды — витрина, формы живут отдельно.
//
// На Э9 экран получил свою колонку (`<main>` + `FORM_MAX_W`): до этого он рисовался голым
// `<div>` прямо в оболочке — без ширины и без полей, то есть на широком мониторе поля формы
// растягивались во весь экран. Ссылка «← к команде» ушла в крошки (UI-GUIDELINES §3).

export default async function TeamEditPage({ params }: { params: Promise<{ id: string }> }) {
  const denied = await denyUnlessPermission("roster.edit", "Правка команды");
  if (denied) return denied;

  const { id } = await params;
  const team = await getTeam(Number(id));
  if (!team) notFound();

  return (
    <main className={`mx-auto w-full ${FORM_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <AdminHeader
        crumbs={[
          { href: "/roster/teams", label: "Команды" },
          { href: `/roster/teams/${team.id}`, label: team.name },
        ]}
        eyebrow="Правка команды"
        title={team.name}
      >
        Слаг <span className="text-ink">{team.slug}</span> — ключ импорта составов и подбора файлов:
        по нему находятся лого и обложка, даже когда поле пустое.
      </AdminHeader>

      <div className="mt-6 space-y-6">
        <TeamEditor
          id={team.id}
          initial={{
            name: team.name,
            tag: team.tag ?? "",
            group: team.group ?? "",
            color: team.color ?? "",
            logo: team.logo,
            wordmark: team.wordmark,
            photo: team.photo,
            banner: team.banner,
          }}
        />

        <p className="font-pouf text-sm font-bold text-muted">
          Состав правится на карточках игроков: роль и капитанство принадлежат месту в составе.
        </p>
      </div>
    </main>
  );
}
