import Link from "next/link";
import { buttonClasses } from "@/components/pouf/Button";
import { SectionHeader } from "@/components/pouf/blocks";
import { EmptyState } from "@/components/pouf/feedback";
import { canCreateLobby, currentViewer, listLobbies } from "@/lib/lobby";
import { Rooms } from "./_components/rooms";

export const dynamic = "force-dynamic";

// Открытые комнаты встреч. Список — дверь: одобренный игрок лиги видит все незакрытые комнаты и
// входит в любую по паролю (ТЗ 42б). Вошедший без одобренной анкеты списка не видит вовсе — его
// зовут приглашением от Spirit CTRL, и кнопка входа живёт в его переписке.

export default async function LobbyIndexPage() {
  const viewer = await currentViewer();
  if (!viewer) return <Gate />;

  const [rows, mayCreate] = await Promise.all([listLobbies(viewer), canCreateLobby()]);
  const listed = viewer.league || viewer.admin;

  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader
        eyebrow="Лига · комната встречи"
        title="Лобби"
        aside={
          mayCreate ? (
            <Link href="/lobby/new" className={`inline-flex ${buttonClasses({ size: "sm" })}`}>
              Собрать лобби
            </Link>
          ) : (
            <>Комнату заводит организатор</>
          )
        }
      />

      {!listed ? (
        <EmptyState icon="lock" title="Комнаты не видны">
          Список комнат открыт игрокам лиги с одобренной анкетой. Пока анкеты нет, в комнату
          попадают по приглашению — оно придёт сообщением от Spirit CTRL, и войти по нему можно без
          пароля.
        </EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState icon="sword" title="Открытых комнат нет">
          Комнату заводит организатор встречи: название, пароль и имена двух сторон. Пароль он
          диктует в голосовом чате — по нему сюда и заходят.
        </EmptyState>
      ) : (
        <Rooms rows={rows} />
      )}
    </div>
  );
}

/** Не вошёл — комнат у него нет по определению. Дверь одна, как и у чата. */
function Gate() {
  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader eyebrow="Лига · комната встречи" title="Лобби" />
      <div className="rounded-control bg-surface p-6 cushion-row">
        <p className="max-w-prose text-sm font-bold text-muted">
          Комнаты встреч открыты участникам лиги: нужно войти и получить одобрение заявки. Пароль
          комнаты без аккаунта не работает — по прямой ссылке её тоже не открыть.
        </p>
        <Link href="/me" className={`mt-4 inline-flex ${buttonClasses()}`}>
          В кабинет
        </Link>
      </div>
    </div>
  );
}
