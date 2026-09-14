import { can } from "@/lib/account";
import { permissionLabel } from "@/lib/permissions";
import { listTournaments } from "@/lib/tournaments";
import { denyUnlessPermission } from "../../../_components/permission-gate";
import { AdminHeader } from "../../../_components/admin-header";
import { ImportForm } from "./import-form";
import { CrmImportForm } from "./crm-form";
import { FORM_MAX_W } from "@/components/pouf/blocks";
import { PillLink } from "@/components/pouf/tabs";
import { Alert } from "@/components/pouf/feedback";

export const dynamic = "force-dynamic";
export const metadata = { title: "Импорт" };

// Один экран, два механизма (Э11): «Составы» разбирают таблицу сезона в команды, игроков и места
// состава, «Анкеты» дозаполняют профили уже заведённых игроков из выгрузки CRM. До Э11 это были два
// адреса, и второй не знал ни про турнир, ни про то, что он не вложен в первый.
//
// Механизм — разрез в адресе (`?mode=`), а не отдельная страница: по обеим пилюлям приходят ссылкой
// с карточки турнира, и адрес обязан открывать нужный инструмент. `?tournament=` живёт рядом и
// действует при любом механизме: имя турнира в шапке, возврат к нему и предвыбор дивизиона у составов.
//
// Обе формы СМОНТИРОВАНЫ всегда, а спрятана неоткрытая: переключение механизма не должно молча
// терять разобранный черновик (он живёт в состоянии клиента). Поэтому же разрез собран ссылками —
// React переиспользует те же клиентские компоненты, состояние переживает смену адреса.

type Mode = "teams" | "players";

export default async function RosterImportPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; tournament?: string }>;
}) {
  const [canTeams, canPlayers] = await Promise.all([can("tournaments.edit"), can("roster.edit")]);

  // Отказ — только тому, у кого нет ни одного механизма. Называем `roster.edit`: под ним стоит
  // плитка на хабе, это общий минимум экрана.
  if (!canTeams && !canPlayers) {
    const denied = await denyUnlessPermission("roster.edit", "Импорт");
    if (denied) return denied;
  }

  const { mode, tournament: fromSlug } = await searchParams;
  const wanted: Mode = mode === "players" ? "players" : "teams";
  const allowed = wanted === "teams" ? canTeams : canPlayers;
  const active: Mode = allowed ? wanted : canTeams ? "teams" : "players";

  const tournaments = await listTournaments();
  const from = fromSlug ? tournaments.find((t) => t.slug === fromSlug) : null;
  const q = fromSlug ? `&tournament=${encodeURIComponent(fromSlug)}` : "";

  return (
    <main className={`mx-auto w-full ${FORM_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      {/* Крошки не передаём: «Админ» шапка ставит сама, а текущую ступень называет H1. */}
      <AdminHeader
        title="Импорт"
        aside={
          from ? (
            <PillLink href={`/admin/tournaments/${from.slug}`}>К турниру «{from.name}»</PillLink>
          ) : undefined
        }
      >
        {active === "teams" ? (
          <>
            Понимаем два вида таблиц: с шапкой колонок («Команда», «Ник», «Роль», «MMR», «Ссылка») и
            блочную раскладку сезонной таблицы LOST — пробуем обе и берём ту, где игроков нашлось
            больше. Ссылки читаем и из текста ячейки, и из гиперссылки, из них же выводится
            account_id. Куда записать — дивизион любого турнира или общий пул без привязки —
            решаете на последнем шаге, после того как увидите, что разобралось. В ростер ничего не
            попадёт раньше.
          </>
        ) : (
          <>
            Дозаполняет анкеты уже существующих игроков лиги: телеграм, дату рождения, город и
            страну, account_id. Новых игроков не заводит — для этого есть механизм «Составы».
            В профиль ничего не попадёт, пока вы не дойдёте до шага «Запись».
          </>
        )}
      </AdminHeader>

      {/* Разрез из одного варианта — не разрез: механизм без права просто не рисуем. */}
      {canTeams && canPlayers && (
        <nav className="mt-6 flex flex-wrap gap-2">
          <PillLink href={`/admin/roster/import?mode=teams${q}`} active={active === "teams"} scroll={false}>
            Составы
          </PillLink>
          <PillLink href={`/admin/roster/import?mode=players${q}`} active={active === "players"} scroll={false}>
            Анкеты
          </PillLink>
        </nav>
      )}

      {!allowed && (
        // Не отказ экрана: по этому адресу приходят ссылкой с карточки турнира, и вторая половина
        // работы человеку доступна. Говорим, какого права не хватило, и открываем то, что можем.
        <Alert tone="warn" block className="mt-6">
          Механизм «{wanted === "teams" ? "Составы" : "Анкеты"}» открывает право «
          {permissionLabel(wanted === "teams" ? "tournaments.edit" : "roster.edit")}» — открыли «
          {active === "teams" ? "Составы" : "Анкеты"}».
        </Alert>
      )}

      {canTeams && (
        <div className="mt-6" hidden={active !== "teams"}>
          <ImportForm
            tournaments={tournaments.map((t) => ({
              slug: t.slug,
              name: t.name,
              divisions: t.divisions.map((d) => ({ id: d.id, name: d.short ?? d.name })),
            }))}
            // Предвыбор только там, где выбирать не из чего: двусмысленность разбирает оператор,
            // потому что тихая запись таблицы D2 в D1 заводит участие в чужом дивизионе.
            defaultDivisionId={from?.divisions.length === 1 ? from.divisions[0].id : null}
            from={from ? { slug: from.slug, name: from.name } : null}
          />
        </div>
      )}

      {canPlayers && (
        <div className="mt-6" hidden={active !== "players"}>
          <CrmImportForm />
        </div>
      )}
    </main>
  );
}
