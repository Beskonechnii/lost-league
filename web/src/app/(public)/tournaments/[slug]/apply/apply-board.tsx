"use client";

import { useActionState, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Button } from "@/components/pouf/Button";
import { FormInput, Label } from "@/components/pouf/Input";
import { Eyebrow } from "@/components/pouf/text";
import { Alert } from "@/components/pouf/feedback";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/pouf/select";
import { slugify } from "@/lib/profiles";
import { submitApplication, type ApplyState } from "./actions";
import { CORE_KEYS, SLOTS, type RosterInput } from "./slots";
import { PlayerLine } from "./board-player";
import { Pool } from "./board-pool";
import { SlotBoard } from "./board-slots";
import { ReadyTeamCard } from "./board-ready";
import type { PoolEntry, TakenSpot, ReadyTeam } from "./pool";

// Доска сборки состава — оболочка: состояние, перетаскивание, форма. Слева пул игроков лиги,
// справа слоты позиций: игрок переносится мышью либо ставится кликом в ближайший свободный слот.
// Раскладка и техника — как у доски драфта UNDERBEER (`app/(admin)/underbeer/[id]/_components/
// draft-board.tsx`), там же обкатан @dnd-kit.
//
// Почему так, а не восемь строк ввода, как было: состав собирается **только из пула** (BOT-PLAN.md,
// Э5). Свободное поле ника позволяло вписать кого угодно, и лига узнавала о человеке уже на апруве.
//
// Состояние доски живёт в клиенте, поэтому ответ сервера ничего не стирает и форму перемонтировать
// не нужно (старая форма ради этого возила введённое туда-обратно).
//
// Э7: файл был на 589 строк и держал в себе пул, слоты, карточку готового состава и строку игрока
// (§C4 RELEASE-PLAN). Части разъехались по соседям — `board-pool`, `board-slots`, `board-ready`,
// `board-player`, — а вид переехал на Кит: подушки вместо рамок, алерты вместо цветных плашек.

/** Значение пункта «дивизион не выбран»: Radix не принимает пустую строку как value. */
const ANY_DIVISION = "any";

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
      <form action={formAction} className="space-y-5 font-pouf">
        <input type="hidden" name="tournamentId" value={tournamentId} />
        <input type="hidden" name="tournamentSlug" value={tournamentSlug} />
        <input type="hidden" name="roster" value={JSON.stringify(roster)} />

        {readyTeams.length > 0 && (
          <section className="space-y-3">
            <Eyebrow>Ваши команды</Eyebrow>
            <p className="text-sm font-bold text-muted">
              Вы капитан — заявите свою команду как есть, состав уже собран. Дальше его можно поправить
              на доске ниже.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {readyTeams.map((rt) => (
                <ReadyTeamCard key={rt.teamId} team={rt} onPick={() => fillFrom(rt)} />
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-4 rounded-card bg-surface p-4 cushion-card sm:grid-cols-3 sm:p-5">
          <label className="block sm:col-span-2">
            <Label className="mb-1.5">Название команды</Label>
            <FormInput value={name} onChange={(e) => setName(e.target.value)} required placeholder="Например: ГУЗЛИКИ" />
          </label>
          <label className="block">
            <Label className="mb-1.5">Тег</Label>
            <FormInput value={tag} onChange={(e) => setTag(e.target.value)} placeholder="ГУЗЛИ" />
          </label>
          {divisions.length > 1 && (
            <div className="block">
              <Label className="mb-1.5">Дивизион</Label>
              {/* «Не знаю» — такой же пункт списка, а не пустое значение: Radix запрещает
                  SelectItem с пустым value, а вернуться к выбору организаторов капитан должен мочь. */}
              <Select
                value={divisionId ? String(divisionId) : ANY_DIVISION}
                onValueChange={(v) => setDivisionId(v === ANY_DIVISION ? null : Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_DIVISION}>— на усмотрение организаторов —</SelectItem>
                  {divisions.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </section>

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
          <SlotBoard
            slots={slots}
            byId={byId}
            captainId={captainId}
            coreCount={coreCount}
            totalCount={totalCount}
            onCaptain={setCaptainId}
            onClear={clearSlot}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Две кнопки на одну форму: intent решает, проверить состав или отправить. Проверка идёт
              по тем же данным, что уйдут в очередь, и не требует второго экрана. */}
          <Button type="submit" name="intent" value="submit" disabled={pending || !ready}>
            {pending ? "Отправляю…" : initial ? "Сохранить заявку" : "Отправить заявку"}
          </Button>
          <Button type="submit" name="intent" value="check" variant="quiet" disabled={pending || totalCount === 0}>
            Проверить состав
          </Button>
          {!ready && (
            <span className="text-xs font-bold text-muted">
              {!name.trim()
                ? "Укажите название команды"
                : coreCount < 5
                  ? `Заполните позиции 1–5: осталось ${5 - coreCount}`
                  : "Отметьте капитана"}
            </span>
          )}
        </div>

        {hint && <Alert tone="warn">{hint}</Alert>}
        {state?.error && <Alert tone="err">{state.error}</Alert>}
        {state?.ok && <Alert tone="ok">{state.ok}</Alert>}

        {/* Замечания: красное закрывает отправку, жёлтое — повод перепроверить, серое — просто факт. */}
        {state?.problems && state.problems.length > 0 && (
          <ul className="space-y-2">
            {state.problems.map((p, i) => (
              <li key={i}>
                {p.level === "block" ? (
                  <Alert tone="err">{p.text}</Alert>
                ) : p.level === "warn" ? (
                  <Alert tone="warn">{p.text}</Alert>
                ) : (
                  <span className="inline-flex rounded-chip bg-surface-2 px-[15px] py-[11px] text-[13px] font-extrabold text-muted cushion-field">
                    {p.text}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </form>

      <DragOverlay>
        {dragId ? (
          <div className="w-64 rounded-control bg-surface opacity-95 cushion-card">
            <PlayerLine player={byId.get(dragId)!} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
