"use client";

import { useActionState, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { PlayerAvatar, TeamLogo } from "@/app/(public)/roster/_components/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { slugify } from "@/lib/profiles";
import { ROLES, roleShort } from "@/lib/roles";
import { submitApplication, type ApplyState } from "./actions";
import { CORE_KEYS, SLOTS, type RosterInput } from "./slots";
import type { PoolEntry, TakenSpot, ReadyTeam } from "./pool";

// Доска сборки состава. Слева — пул игроков лиги, справа — слоты позиций: игрок переносится мышью
// либо ставится кликом в ближайший свободный слот. Раскладка и техника — как у доски драфта
// UNDERBEER (`src/app/(admin)/underbeer/[id]/_components/draft-board.tsx`), там же обкатан @dnd-kit.
//
// Почему так, а не восемь строк ввода, как было: состав собирается **только из пула** (BOT-PLAN.md,
// Э5). Свободное поле ника позволяло вписать кого угодно, и лига узнавала о человеке уже на апруве.
//
// Состояние доски живёт в клиенте, поэтому ответ сервера ничего не стирает и форму перемонтировать
// не нужно (старая форма ради этого возила введённое туда-обратно).

const errorBox = "rounded-md border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300";
const SCROLL =
  "[scrollbar-width:thin] [scrollbar-color:#404040_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-surface-3";

/** Кто в каком слоте: ключ слота → id игрока пула. */
type Filled = Record<string, number | null>;

const emptySlots = (): Filled => Object.fromEntries(SLOTS.map((s) => [s.key, null]));

export function ApplyBoard({
  tournamentId,
  tournamentSlug,
  divisions,
  pool,
  taken,
  inviteUrl,
  readyTeams,
  initial,
}: {
  tournamentId: number;
  tournamentSlug: string;
  divisions: { id: number; name: string }[];
  pool: PoolEntry[];
  taken: TakenSpot[];
  /** Ссылка-приглашение в бота; null — бот не настроен, тогда просто объясняем словами. */
  inviteUrl: string | null;
  /** Готовые составы команд, где вошедший — капитан: заполняют доску одной кнопкой. */
  readyTeams: ReadyTeam[];
  /** Уже поданная заявка, разложенная по слотам: повторная подача правит её, а не плодит строку. */
  initial: { name: string; tag: string; divisionId: number | null; slots: Filled; captainId: number | null } | null;
}) {
  const [state, formAction, pending] = useActionState<ApplyState, FormData>(submitApplication, null);

  const [name, setName] = useState(initial?.name ?? "");
  const [tag, setTag] = useState(initial?.tag ?? "");
  // Дивизион один — выбирать нечего, проставляем молча: вопрос из одного варианта это не вопрос.
  const [divisionId, setDivisionId] = useState<number | null>(
    initial?.divisionId ?? (divisions.length === 1 ? divisions[0].id : null),
  );
  const [slots, setSlots] = useState<Filled>(initial?.slots ?? emptySlots());
  // Капитан хранится игроком, а не слотом: при переносе между позициями капитанство едет с человеком.
  const [captainId, setCaptainId] = useState<number | null>(initial?.captainId ?? null);
  const [query, setQuery] = useState("");
  // Фильтр по позиции: в пуле под две сотни человек, а капитан ищет «кто у нас на четвёрку».
  // Позиция берётся из ростера (основное место игрока), а не из слота, куда его ставят.
  const [role, setRole] = useState<string | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const byId = useMemo(() => new Map(pool.map((p) => [p.id, p])), [pool]);
  const placed = useMemo(
    () => new Map(Object.entries(slots).flatMap(([key, id]) => (id ? [[id, key] as const] : []))),
    [slots],
  );

  // Занятые: действующий (поз. 1–5) в другой команде этого дивизиона. Свою же команду не считаем —
  // при повторной заявке того же состава её игроки не «заняты» сами собой (то же правило, что в
  // `applicationProblems` перед записью).
  const ourSlug = slugify(name);
  const busy = useMemo(() => {
    const map = new Map<number, string>();
    for (const s of taken) {
      if (s.divisionId !== divisionId || s.teamSlug === ourSlug) continue;
      map.set(s.playerId, s.teamName);
    }
    return map;
  }, [taken, divisionId, ourSlug]);

  const found = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return pool.filter((p) => {
      if (role && p.role !== role) return false;
      if (!needle) return true;
      return (
        p.nickname.toLowerCase().includes(needle) ||
        (p.realName ?? "").toLowerCase().includes(needle) ||
        (p.teamName ?? "").toLowerCase().includes(needle)
      );
    });
  }, [pool, query, role]);

  const coreCount = CORE_KEYS.filter((k) => slots[k]).length;
  const totalCount = Object.values(slots).filter(Boolean).length;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  /** Поставить игрока в слот. Занятый слот меняется местами с прежним местом игрока, а не затирается. */
  function place(slotKey: string, playerId: number) {
    if (busy.has(playerId)) {
      setHint(`«${byId.get(playerId)?.nickname}» уже действующий в составе «${busy.get(playerId)}» этого дивизиона`);
      return;
    }
    setHint(null);
    setSlots((prev) => {
      const next = { ...prev };
      const from = Object.keys(next).find((k) => next[k] === playerId);
      const displaced = next[slotKey];
      next[slotKey] = playerId;
      if (from && from !== slotKey) next[from] = displaced ?? null;
      return next;
    });
    setCaptainId((c) => c ?? playerId); // первый поставленный становится капитаном, дальше меняется вручную
  }

  /** Заполнить доску готовым составом капитана — имя, тег и все слоты разом. */
  function fillFrom(rt: ReadyTeam) {
    setName(rt.name);
    setTag(rt.tag);
    setSlots({ ...emptySlots(), ...rt.slots });
    setCaptainId(rt.captainId);
    setHint(
      rt.lost > 0
        ? `Из состава «${rt.name}» не в пуле лиги: ${rt.lost} — этих игроков добавьте вручную`
        : null,
    );
  }

  function clearSlot(slotKey: string) {
    if (slots[slotKey] && slots[slotKey] === captainId) setCaptainId(null);
    setSlots((prev) => ({ ...prev, [slotKey]: null }));
  }

  /** Клик по игроку пула: в первый свободный слот — основа, потом замены и тренер. */
  function tap(playerId: number) {
    if (placed.has(playerId)) return clearSlot(placed.get(playerId)!);
    const free = SLOTS.find((s) => !slots[s.key]);
    if (!free) return setHint("Все слоты заняты — уберите кого-нибудь, чтобы поставить нового");
    place(free.key, playerId);
  }

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    setDragId(id.startsWith("pool:") ? Number(id.slice(5)) : (slots[id.slice(7)] ?? null));
  }

  function onDragEnd(e: DragEndEvent) {
    const active = String(e.active.id);
    const playerId = dragId;
    setDragId(null);
    const over = e.over ? String(e.over.id) : null;
    if (!playerId) return;
    if (over?.startsWith("slot:")) return place(over.slice(5), playerId);
    // Вытащили из состава мимо слотов — освобождаем место: это тот же жест, что «убрать».
    if (active.startsWith("placed:")) clearSlot(active.slice(7));
  }

  const roster: RosterInput = {
    name,
    tag,
    divisionId,
    players: SLOTS.flatMap((s) => {
      const id = slots[s.key];
      return id ? [{ playerId: id, role: s.role, isCaptain: id === captainId }] : [];
    }),
  };
  const ready = name.trim().length > 0 && coreCount === 5 && captainId !== null;

  return (
    // `id` обязателен: без него @dnd-kit нумерует служебные `aria-describedby` счётчиком, и на
    // сервере с клиентом номера расходятся — React ругается несовпадением гидратации.
    <DndContext id="apply-board" sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="tournamentId" value={tournamentId} />
        <input type="hidden" name="tournamentSlug" value={tournamentSlug} />
        <input type="hidden" name="roster" value={JSON.stringify(roster)} />

        {readyTeams.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-ink-muted">
              Вы капитан — заявите свою команду как есть, состав уже собран. Дальше его можно поправить
              на доске ниже.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {readyTeams.map((rt) => (
                <ReadyTeamCard key={rt.teamId} team={rt} onPick={() => fillFrom(rt)} />
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block sm:col-span-2">
            <span className="text-xs text-ink-muted">Название команды</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Например: ГУЗЛИКИ" className="mt-1" />
          </label>
          <label className="block">
            <span className="text-xs text-ink-muted">Тег</span>
            <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="ГУЗЛИ" className="mt-1" />
          </label>
          {divisions.length > 1 && (
            <label className="block">
              <span className="text-xs text-ink-muted">Дивизион</span>
              <select
                value={divisionId ?? ""}
                onChange={(e) => setDivisionId(e.target.value ? Number(e.target.value) : null)}
                className="mt-1 h-9 w-full rounded-md border border-hairline bg-surface-2 px-2 text-sm"
              >
                <option value="">— на усмотрение организаторов —</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Pool
            found={found}
            query={query}
            setQuery={setQuery}
            role={role}
            setRole={setRole}
            busy={busy}
            placed={placed}
            onTap={tap}
            inviteUrl={inviteUrl}
          />

          {/* min-w-0 обязателен обеим колонкам: без него ячейка грида растягивается по самой длинной
              строке игрока (min-width: auto), truncate не срабатывает и страница едет вбок. */}
          <div className="min-w-0 space-y-2">
            <div className="flex items-baseline justify-between">
              <h2 className="font-pouf text-sm font-bold uppercase tracking-wide text-ink-muted">Состав</h2>
              <span className="text-xs text-ink-subtle">
                основа {coreCount}/5 · всего {totalCount}
              </span>
            </div>
            {SLOTS.map((s) => (
              <SlotRow
                key={s.key}
                slotKey={s.key}
                label={s.label}
                core={s.core}
                player={slots[s.key] ? byId.get(slots[s.key]!) ?? null : null}
                isCaptain={!!slots[s.key] && slots[s.key] === captainId}
                onCaptain={() => slots[s.key] && setCaptainId(slots[s.key]!)}
                onClear={() => clearSlot(s.key)}
              />
            ))}
            <p className="text-xs text-ink-subtle">
              Капитан — кружком у слота; это тот, с кем организаторы будут договариваться о встречах,
              а не обязательно тот, кто подаёт заявку. MMR заявленный: итоговую цифру ставит организатор.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Две кнопки на одну форму: intent решает, проверить состав или отправить. Проверка идёт
              по тем же данным, что уйдут в очередь, и не требует второго экрана. */}
          <Button type="submit" name="intent" value="submit" disabled={pending || !ready}>
            {pending ? "Отправляю…" : initial ? "Сохранить заявку" : "Отправить заявку"}
          </Button>
          <Button type="submit" name="intent" value="check" variant="outline" disabled={pending || totalCount === 0}>
            Проверить состав
          </Button>
          {!ready && (
            <span className="text-xs text-ink-subtle">
              {!name.trim()
                ? "Укажите название команды"
                : coreCount < 5
                  ? `Заполните позиции 1–5: осталось ${5 - coreCount}`
                  : "Отметьте капитана"}
            </span>
          )}
        </div>

        {hint && <p className="text-xs text-amber-300">{hint}</p>}
        {state?.error && <p className={errorBox}>{state.error}</p>}
        {state?.ok && <p className="text-sm text-emerald-400">{state.ok}</p>}

        {/* Замечания: красное закрывает отправку, жёлтое — повод перепроверить, серое — просто факт. */}
        {state?.problems && state.problems.length > 0 && (
          <ul className="space-y-1">
            {state.problems.map((p, i) => (
              <li
                key={i}
                className={`rounded-md border px-3 py-1.5 text-xs ${
                  p.level === "block"
                    ? "border-rose-900 bg-rose-950/40 text-rose-300"
                    : p.level === "warn"
                      ? "border-amber-900 bg-amber-950/40 text-amber-300"
                      : "border-hairline bg-surface-2 text-ink-subtle"
                }`}
              >
                {p.text}
              </li>
            ))}
          </ul>
        )}
      </form>

      <DragOverlay>
        {dragId ? (
          <div className="w-64 rounded-md border border-accent bg-surface-1 opacity-95">
            <PlayerLine player={byId.get(dragId)!} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ── готовый состав капитана ───────────────────────────────────────────────────

/**
 * Карточка команды, где вошедший — капитан: лого, название и весь состав с ролями и MMR. Кнопка
 * переносит состав на доску заявки. Игроков вне пула лиги (без account_id) показываем блёкло и с
 * пометкой — в заявку они не уедут, их капитан добавит вручную.
 */
function ReadyTeamCard({ team, onPick }: { team: ReadyTeam; onPick: () => void }) {
  const accent = team.color ?? undefined;
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface-1">
      <div
        className="flex items-center gap-3 px-3 py-2.5"
        style={accent ? { background: `linear-gradient(100deg, ${accent}26, transparent 70%)` } : undefined}
      >
        <TeamLogo team={{ name: team.name, tag: team.tag, logo: team.logo }} size={40} className="!rounded-lg" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-pouf text-sm font-bold uppercase tracking-wide">{team.name}</div>
          {team.tag && <div className="truncate text-xs text-ink-subtle">{team.tag}</div>}
        </div>
        <span className="shrink-0 text-xs text-ink-subtle">{team.players.length} чел.</span>
      </div>

      <ul className="divide-y divide-hairline/60">
        {team.players.map((p) => (
          <li key={p.id} className={`flex items-center gap-2 px-3 py-1.5 ${p.inPool ? "" : "opacity-45"}`}>
            <PlayerAvatar photo={p.photo} nickname={p.nickname} color={team.color} size={28} className="!rounded-md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium">{p.nickname}</span>
                {p.isCaptain && <span className="shrink-0 text-[11px] font-black text-accent-bright">C</span>}
              </div>
              <div className="truncate text-[11px] text-ink-subtle">
                {[roleShort(p.role), p.realName].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
            {p.inPool ? (
              <span className="shrink-0 text-right text-[11px] text-ink-muted">
                {p.mmr ? p.mmr.toLocaleString("ru-RU") : "—"}
                <span className="block text-[10px] text-ink-subtle">MMR</span>
              </span>
            ) : (
              <span className="shrink-0 text-[10px] text-amber-300">нет в пуле</span>
            )}
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <Button type="button" size="sm" onClick={onPick}>Заявить этот состав</Button>
        {team.lost > 0 && (
          <span className="text-right text-[11px] text-amber-300">
            {team.lost} без account_id — добавьте вручную
          </span>
        )}
      </div>
    </div>
  );
}

// ── пул ──────────────────────────────────────────────────────────────────────

function Pool({
  found,
  query,
  setQuery,
  role,
  setRole,
  busy,
  placed,
  onTap,
  inviteUrl,
}: {
  found: PoolEntry[];
  query: string;
  setQuery: (v: string) => void;
  role: string | null;
  setRole: (v: string | null) => void;
  busy: Map<number, string>;
  placed: Map<number, string>;
  onTap: (id: number) => void;
  inviteUrl: string | null;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="font-pouf text-sm font-bold uppercase tracking-wide text-ink-muted">Игроки лиги</h2>
        <span className="text-xs text-ink-subtle">{found.length}</span>
      </div>
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по нику, имени или команде" />
      {/* Позиции — кнопками, а не выпадающим списком: их шесть, и выбор в один клик тут важнее
          экономии места (то же решение, что у вкладок дивизионов). */}
      <div className="flex flex-wrap gap-1.5 font-pouf">
        {[{ key: null as string | null, short: "Все" }, ...ROLES.filter((r) => r.position !== null)].map((r) => (
          <button
            key={r.key ?? "all"}
            type="button"
            onClick={() => setRole(r.key)}
            className={`inline-flex items-center rounded-[14px] px-3 py-[5px] text-[12px] font-black transition-[box-shadow,transform,background] ${
              role === r.key
                ? "bg-purple text-[var(--on-accent)] cushion-control"
                : "bg-surface text-ink-muted cushion-field hover:text-ink"
            }`}
          >
            {r.short}
          </button>
        ))}
      </div>
      <div className={`max-h-[28rem] space-y-1 overflow-y-auto rounded-lg border border-hairline bg-surface-1/40 p-1.5 ${SCROLL}`}>
        {found.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-ink-subtle">
            Никого не нашли. В списке только игроки лиги — новичка сначала регистрируют в боте.
          </p>
        )}
        {found.map((p) => (
          <PoolCard key={p.id} player={p} busyIn={busy.get(p.id) ?? null} placedAt={placed.has(p.id)} onTap={() => onTap(p.id)} />
        ))}
      </div>
      <p className="rounded-md border border-hairline bg-surface-1 px-3 py-2 text-xs text-ink-muted">
        Нет игрока в списке? В составе может быть только тот, кого лига знает.{" "}
        {inviteUrl ? (
          <>
            Пришлите ему ссылку{" "}
            <a href={inviteUrl} target="_blank" rel="noreferrer" className="break-all text-accent-bright hover:underline">
              {inviteUrl}
            </a>{" "}
            — он зарегистрируется в боте и появится здесь.
          </>
        ) : (
          <>Попросите его зарегистрироваться в телеграм-боте лиги — после этого он появится здесь.</>
        )}
      </p>
    </div>
  );
}

function PoolCard({
  player,
  busyIn,
  placedAt,
  onTap,
}: {
  player: PoolEntry;
  busyIn: string | null;
  placedAt: boolean;
  onTap: () => void;
}) {
  const locked = !!busyIn || placedAt;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `pool:${player.id}`, disabled: locked });
  return (
    <div
      ref={setNodeRef}
      {...(locked ? {} : { ...listeners, ...attributes })}
      onClick={onTap}
      title={busyIn ? `Уже действующий в составе «${busyIn}» этого дивизиона` : undefined}
      className={`rounded-md border transition-colors ${
        locked
          ? "border-hairline opacity-40"
          : "cursor-pointer border-hairline hover:border-accent active:cursor-grabbing"
      } ${isDragging ? "opacity-30" : ""}`}
    >
      <PlayerLine player={player} note={busyIn ? `занят: ${busyIn}` : placedAt ? "в составе" : null} />
    </div>
  );
}

// ── слоты ────────────────────────────────────────────────────────────────────

function SlotRow({
  slotKey,
  label,
  core,
  player,
  isCaptain,
  onCaptain,
  onClear,
}: {
  slotKey: string;
  label: string;
  core: boolean;
  player: PoolEntry | null;
  isCaptain: boolean;
  onCaptain: () => void;
  onClear: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${slotKey}` });
  // Игрока из слота тоже можно тащить: в другой слот — перестановка, мимо слотов — «убрать».
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `placed:${slotKey}`,
    disabled: !player,
  });
  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-2 rounded-md border bg-surface-1/40 p-1.5 transition-colors ${
        isOver ? "border-accent" : core && !player ? "border-dashed border-hairline" : "border-hairline"
      }`}
    >
      <input
        type="radio"
        name="captain-slot"
        checked={isCaptain}
        onChange={onCaptain}
        disabled={!player}
        aria-label="капитан"
        className="ml-1 shrink-0"
      />
      <span className="w-28 shrink-0 text-xs text-ink-subtle">{label}</span>
      {player ? (
        <>
          <div
            ref={setDragRef}
            {...listeners}
            {...attributes}
            className={`min-w-0 flex-1 cursor-grab active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}
          >
            <PlayerLine player={player} />
          </div>
          <button type="button" onClick={onClear} className="shrink-0 px-2 text-ink-subtle hover:text-rose-400" title="Убрать">
            ✕
          </button>
        </>
      ) : (
        <span className="flex-1 px-2 py-2 text-xs text-ink-subtle">
          перетащите игрока или нажмите на него в списке
        </span>
      )}
    </div>
  );
}

/** Строка игрока — общий вид для пула, слота и оверлея перетаскивания. */
function PlayerLine({ player, note }: { player: PoolEntry; note?: string | null }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <PlayerAvatar photo={player.photo} nickname={player.nickname} color={player.color} size={30} className="!rounded-md" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{player.nickname}</div>
        <div className="truncate text-[11px] text-ink-subtle">
          {[player.realName, player.teamName, roleShort(player.role)].filter(Boolean).join(" · ") || "без команды"}
        </div>
      </div>
      {note ? (
        <span className="shrink-0 text-[10px] text-ink-subtle">{note}</span>
      ) : (
        <span className="shrink-0 text-right text-[11px] text-ink-muted">
          {player.mmr ? player.mmr.toLocaleString("ru-RU") : "—"}
          <span className="block text-[10px] text-ink-subtle">MMR</span>
        </span>
      )}
    </div>
  );
}
