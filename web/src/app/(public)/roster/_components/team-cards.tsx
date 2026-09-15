"use client";

import { useState } from "react";
import Link from "next/link";
import type { RosterMember, TeamWithRoster, PoolTournament } from "@/lib/roster-data";
import type { Rating } from "@/lib/tp";
import { countryCode, playerPath, teamAccent, teamTag } from "@/lib/profiles";
import { roleLabel } from "@/lib/roles";
import { Chip, Meter } from "@/components/pouf/blocks";
import { Icon } from "@/components/pouf/Icon";
import { pillClasses } from "@/components/pouf/tabs";
import { PlayerAvatar } from "./avatar";
import { TeamManageBar } from "./team-manage-bar";

// Карточка в общем пуле несёт метки турниров и (у оператора) бар управления — этих полей нет у
// витрины турнира, поэтому они опциональны: тот же компонент рисует и список сезона, и пул.
type PoolFields = {
  tournaments?: PoolTournament[];
  archivedAt?: Date | string | null;
  /** Рейтинг (TP за турнир) — только в пуле: `null` рисует прочерк, `undefined` убирает цифру вовсе. */
  rating?: Rating | null;
};

// Карточка команды в списке: шапка с лого, разворачивается в состав. «Основа» и «Штаб» — вкладки,
// потому что замены и тренер в общем списке съедали внимание, хотя смотрят обычно на пятёрку.
// Оформление — «полиш»: мягкая тень и свечение, цвет команды в рейке и плитке лого, у игрока —
// чип роли и мини-бар силы MMR.

/** Штаб — всё, что не позиция 1–5: замены и тренер. Правило то же, что и в расчёте MMR команды. */
const isCore = (p: RosterMember) => p.position !== null;

/** MMR → доля шкалы 2000…11000 для мини-бара. Пол в 6%, чтобы у слабых состав был виден. */
function mmrPct(mmr: number | null): number {
  if (!mmr) return 0;
  return Math.max(6, Math.min(100, Math.round(((mmr - 2000) / 9000) * 100)));
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      // Разрез состава — та же пилюля Кита, что у вкладок дивизиона: раньше здесь стоял свой
      // рисунок с ВДАВЛЕННОЙ активной вкладкой, и на странице ростера рядом жили два ответа
      // на вопрос «где я сейчас». `flex-1` — только раскладка (две вкладки делят ширину).
      className={pillClasses({ active, className: "flex-1 justify-center" })}
    >
      {children}
    </button>
  );
}

function PlayerRow({ player, accent }: { player: RosterMember; accent: string }) {
  const code = countryCode(player.country);
  const role = roleLabel(player.role);

  return (
    <Link
      href={playerPath(player)}
      // Подсветка строки — мятная полоса Кита; раньше здесь лежал сырой фиолетовый
      // rgba(124,58,237,…) из тёмной темы, мимо токенов акцента.
      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[linear-gradient(90deg,color-mix(in_srgb,var(--accent-fill)_55%,transparent),transparent)]"
    >
      <PlayerAvatar photo={player.photo} nickname={player.nickname} color={accent} size={30} className="rounded-[10px]" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold text-ink">{player.nickname}</span>
          {player.isCaptain && <span className="shrink-0 text-[11px] font-black text-[var(--accent-ink)]">C</span>}
          {code && <span className="shrink-0 text-[10px] font-bold text-muted">{code}</span>}
          {/* пока добиваем ростер: точка вместо строки, чтобы не ломать ряд */}
          {!player.accountId && (
            <span className="shrink-0 text-warn-ink" title="нет account_id">
              •
            </span>
          )}
        </div>
        {role && <Chip className="mt-1">{role}</Chip>}
      </div>

      <div className="shrink-0 text-right">
        <div className="text-sm font-bold tabular-nums text-ink">
          {player.mmr ? player.mmr.toLocaleString("ru") : "—"}
        </div>
        {player.mmr ? <Meter pct={mmrPct(player.mmr)} className="mt-1 ml-auto w-14" /> : null}
      </div>
    </Link>
  );
}

function TeamCard({
  team,
  defaultOpen,
  manage,
  onManaged,
  leader = false,
}: {
  team: TeamWithRoster & PoolFields;
  defaultOpen: boolean;
  /** Пул у оператора: показать бар управления (архив/возврат/снос). `archived` — в каком мы разрезе. */
  manage?: { archived: boolean };
  onManaged?: (teamId: number) => void;
  /** Первое место в сетке: карточка занимает две колонки и растёт знаком и именем. */
  leader?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [tab, setTab] = useState<"main" | "staff">("main");

  const accent = teamAccent(team);
  const core = team.players.filter(isCore);
  const staff = team.players.filter((p) => !isCore(p));
  const shown = tab === "main" ? core : staff;
  // Рейтинг показываем только там, где он передан (пул): витрине турнира цифра TP не нужна.
  const rated = team.rating !== undefined;

  // Строка под именем. В пуле главная цифра карточки — TP, поэтому MMR переезжает сюда: две крупные
  // плитки рядом не оставляли имени команды места на узкой колонке сетки, а число игроков видно,
  // как только состав развёрнут. Без рейтинга (витрина турнира) строка прежняя.
  const meta = open
    ? [teamTag(team), team.group]
    : [
        teamTag(team),
        rated && team.mmrAverage !== null
          ? `${team.mmrAverage.toLocaleString("ru")} MMR`
          : `${team.playersCount} игрок(ов)`,
      ];

  return (
    <div
      style={{ "--tc": accent } as React.CSSProperties}
      className={`group relative overflow-hidden rounded-card bg-surface font-pouf cushion-card transition-transform duration-200 hover:-translate-y-0.5 ${
        leader ? "sm:col-span-2" : ""
      }`}
    >
      {/* рейка и верхнее свечение в цвет команды — карточки различимы с одного взгляда */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
        style={{ background: "linear-gradient(90deg, var(--tc), transparent 72%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24"
        style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--tc) 12%, transparent), transparent)" }}
      />

      <div className="relative flex items-center gap-3 p-4">
        {/* Место в рейтинге — перед знаком: список читается сверху вниз номерами, как зачёт.
            Прочерк у тех, кому за турнир ещё не начисляли (ТЗ 13). */}
        {rated && (
          <div
            className={`shrink-0 text-center font-black tabular-nums ${
              // Крупный номер и знак у лидера — только от sm: на 390 колонка одна, прибавка шла
              // прямо из ширины имени, и карточка, которая существует ради показа лидера, обрезала
              // как раз его имя. На телефоне лидера отличают акцентный номер и цифра TP.
              leader ? "w-5 text-[13px] text-[var(--accent-ink)] sm:w-8 sm:text-2xl" : "w-5 text-[13px] text-muted"
            }`}
          >
            {team.rating ? team.rating.place : "—"}
          </div>
        )}

        {/* плитка лого: всегда цветная подложка команды, внутри лого или тег */}
        <div
          className={`grid shrink-0 place-items-center overflow-hidden rounded-xl text-xs font-bold text-white shadow-[0_8px_20px_-8px_var(--tc)] ${
            leader ? "h-11 w-11 sm:h-16 sm:w-16" : "h-11 w-11"
          }`}
          style={{ background: "linear-gradient(145deg, var(--tc), color-mix(in srgb, var(--tc) 45%, #000))" }}
        >
          {team.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logo} alt={team.name} className="h-full w-full object-contain p-1" />
          ) : (
            teamTag(team)
          )}
        </div>

        <Link href={`/roster/teams/${team.id}`} className="group/link min-w-0 flex-1">
          <div
            className={`truncate font-black tracking-[-0.2px] text-ink group-hover/link:text-[var(--accent-ink)] ${
              leader ? "sm:text-xl" : ""
            }`}
          >
            {team.name}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs font-bold text-muted">
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--tc)" }} />
            {meta.filter(Boolean).join(" · ")}
          </div>
        </Link>

        {rated ? (
          <div className="shrink-0 rounded-[14px] bg-accent-fill px-3 py-1.5 text-right text-[var(--on-accent)] cushion-control">
            <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--on-accent-muted)]">TP</div>
            <div className={`font-black tabular-nums ${leader ? "text-base sm:text-2xl" : "text-base"}`}>
              {team.rating ? team.rating.score.toLocaleString("ru") : "—"}
            </div>
          </div>
        ) : (
          team.mmrAverage !== null && (
            <div className="shrink-0 rounded-[14px] bg-accent-fill px-3 py-1.5 text-right text-[var(--on-accent)] cushion-control">
              <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--on-accent-muted)]">ср. MMR</div>
              <div className="text-base font-black tabular-nums">{team.mmrAverage.toLocaleString("ru")}</div>
            </div>
          )
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Свернуть состав" : "Развернуть состав"}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[14px] bg-surface text-muted cushion-field transition hover:text-[var(--accent-ink)]"
        >
          {/* Значок Кита вместо своего path: стрелка «развернуть» рисуется в проекте одна. */}
          <span className={`grid transition-transform ${open ? "rotate-180" : ""}`}>
            <Icon name="expand" size="sm" />
          </span>
        </button>
      </div>

      {/* Метки турниров — только в пуле (там карточка сквозная по сезонам): в каком из них команда
          играла. В витрине одного турнира это лишний шум, поэтому поле опционально. */}
      {team.tournaments && team.tournaments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
          {team.tournaments.map((tr) => (
            <Chip key={tr.slug}>{tr.short || tr.name}</Chip>
          ))}
        </div>
      )}

      {open && (
        <div className="relative">
          <div className="flex gap-1.5 px-4 pb-3">
            <Tab active={tab === "main"} onClick={() => setTab("main")}>
              Основа
            </Tab>
            <Tab active={tab === "staff"} onClick={() => setTab("staff")}>
              Штаб{staff.length > 0 && <span className="ml-1 opacity-60">{staff.length}</span>}
            </Tab>
          </div>

          <div className="divide-y divide-hairline border-t border-hairline pb-1">
            {shown.length === 0 ? (
              <p className="px-4 py-4 text-xs font-bold text-muted">
                {tab === "main" ? "Основа не заведена." : "Ни замен, ни тренера."}
              </p>
            ) : (
              shown.map((p) => <PlayerRow key={p.id} player={p} accent={accent} />)
            )}
          </div>
        </div>
      )}

      {manage && (
        <TeamManageBar teamId={team.id} teamName={team.name} archived={manage.archived} onDone={onManaged} />
      )}
    </div>
  );
}

export function TeamCards({
  teams,
  manage,
  onManaged,
  leaderId = null,
}: {
  teams: (TeamWithRoster & PoolFields)[];
  manage?: { archived: boolean };
  /** Пул: карточку убирают из вида сразу после успешного действия оператора (см. PoolExplorer). */
  onManaged?: (teamId: number) => void;
  /** Команда, чью карточку рисуем крупной. Условия «когда лидер настоящий» решает PoolExplorer. */
  leaderId?: number | null;
}) {
  // Ключ по «свёрнутости всех» — самый дешёвый способ разом переоткрыть карточки:
  // меняем ключ, React пересоздаёт их с нужным начальным состоянием.
  const [generation, setGeneration] = useState(0);
  // По умолчанию составы свёрнуты: сначала виден список команд, состав разворачивается по клику.
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="space-y-4 font-pouf">
      {/* Фильтр дивизиона живёт на странице, в query (DivTabs), — свой второй ряд вкладок здесь стоял
          за тот же выбор и путал: два ряда, одно решение (UI-GUIDELINES §2, L4). */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            setCollapsed((v) => !v);
            setGeneration((g) => g + 1);
          }}
          className="shrink-0 text-xs font-bold text-muted transition-colors hover:text-[var(--accent-ink)]"
        >
          {collapsed ? "Развернуть все составы" : "Свернуть все составы"}
        </button>
      </div>

      <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {teams.map((t) => (
          <TeamCard
            key={`${t.id}-${generation}`}
            team={t}
            defaultOpen={!collapsed}
            manage={manage}
            onManaged={onManaged}
            leader={t.id === leaderId}
          />
        ))}
      </div>
    </div>
  );
}
