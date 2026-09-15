"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/pouf/Button";
import { Checkbox } from "@/components/pouf/checkbox";
import { Field, FormInput, FormSelect } from "@/components/pouf/Input";
import { Alert } from "@/components/pouf/feedback";
import { Card } from "@/components/pouf/surface";
import { PillButton, PillTrack } from "@/components/pouf/tabs";
import { Eyebrow } from "@/components/pouf/text";
import type { TeamIdx } from "@/lib/fearless";
import { ROLE_LABEL, type LobbyRole } from "@/lib/lobby-room";

/**
 * Сбор комнаты: название, две стороны, тайминги и список приглашённых.
 *
 * Стороны — команды ростера, а не свободные строки: из команды сразу берутся имя, цвет и состав,
 * а состав и есть список приглашённых. Отмеченные галочкой получат сообщение от Spirit CTRL
 * с кнопкой «Войти в лобби»; роль рядом решает, ходит человек за сторону или только смотрит.
 *
 * Тайминги — поля, а не константы: к команде могут применяться пенальти (решение 5). Пусто —
 * подставляются дефолты движка.
 */

export type LobbyTeam = {
  id: number;
  name: string;
  color: string;
  /** `invitable` — у игрока есть одобренный аккаунт. Без него звать некуда: приглашение приходит
   *  сообщением, а вход в комнату — по аккаунту (решение 12). */
  players: { id: number; nickname: string; role: string | null; invitable: boolean }[];
};

const BEST_OF = [1, 2, 3, 5];
const ROLES: LobbyRole[] = ["player", "coach", "caster"];
/** Роли, которые НЕ занимают места в составе: ими зовут человека вне обеих команд (ТЗ 22в §3). */
const GUEST_ROLES: LobbyRole[] = ["caster", "admin"];

type Picked = { on: boolean; role: LobbyRole };

/** Позванный вне составов: стороны у него нет, и она не подставляется — он не место в пятёрке. */
type Guest = { playerId: number; role: LobbyRole };

export function NewLobbyForm({
  teams,
  people,
  series,
  defaults,
}: {
  teams: LobbyTeam[];
  /** Все игроки лиги с аккаунтом — из них зовут ОБС и второго админа комнаты. */
  people: { id: number; nickname: string }[];
  series: { id: number; label: string }[];
  defaults: { mainSec: number; reserveSec: number };
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [aId, setAId] = useState<number | null>(teams[0]?.id ?? null);
  const [bId, setBId] = useState<number | null>(teams[1]?.id ?? null);
  const [bestOf, setBestOf] = useState(3);
  const [mainSec, setMainSec] = useState(String(defaults.mainSec));
  const [reserveSec, setReserveSec] = useState(String(defaults.reserveSec));
  const [seriesId, setSeriesId] = useState("");
  // Выбор приглашённых держим по id игрока: сторона выводится из того, в чьём составе он стоит.
  const [picked, setPicked] = useState<Record<number, Picked>>({});
  const [guests, setGuests] = useState<Guest[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const a = teams.find((t) => t.id === aId) ?? null;
  const b = teams.find((t) => t.id === bId) ?? null;
  const ready = !!title.trim() && a && b && a.id !== b.id;

  const toggle = (id: number, on: boolean) =>
    setPicked((p) => ({ ...p, [id]: { role: p[id]?.role ?? "player", on } }));
  const setRole = (id: number, role: LobbyRole) =>
    setPicked((p) => ({ ...p, [id]: { on: p[id]?.on ?? true, role } }));

  async function submit() {
    if (!a || !b) return;
    setBusy(true);
    setError(null);
    const invites = [
      ...[a, b].flatMap((team, i) =>
        team.players.flatMap((p) => {
          const row = picked[p.id];
          return row?.on ? [{ playerId: p.id, side: i as TeamIdx, role: row.role }] : [];
        }),
      ),
      // Позванные вне составов идут БЕЗ стороны: сервер их так и запишет, и на готовность
      // сторон они не влияют.
      ...guests.map((g) => ({ playerId: g.playerId, side: null, role: g.role })),
    ];
    try {
      const res = await fetch("/api/lobby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          sideATeamId: a.id,
          sideBTeamId: b.id,
          mainSec: Number(mainSec),
          reserveSec: Number(reserveSec),
          bestOf,
          seriesId: seriesId ? Number(seriesId) : null,
          invites,
        }),
      });
      const data = (await res.json()) as { id?: number; error?: string };
      if (!res.ok || !data.id) {
        setError(data.error ?? "Не получилось собрать лобби");
        return;
      }
      router.push(`/lobby/${data.id}`);
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Card variant="tight">
        <div className="space-y-4">
          <Field label="Название встречи" hint="Его увидят приглашённые в сообщении от Spirit CTRL.">
            {(id) => (
              <FormInput
                id={id}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="D1 · SPIRIT vs CTRL"
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <SidePick label="Сторона A" teams={teams} value={aId} onChange={setAId} exclude={bId} />
            <SidePick label="Сторона B" teams={teams} value={bId} onChange={setBId} exclude={aId} />
          </div>

          <div>
            <Eyebrow className="mb-1.5">Формат серии</Eyebrow>
            <div className="max-w-[18rem]">
              <PillTrack label="Формат серии">
                {BEST_OF.map((n) => (
                  <PillButton key={n} active={bestOf === n} variant="quiet" onClick={() => setBestOf(n)}>
                    Bo{n}
                  </PillButton>
                ))}
              </PillTrack>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Время хода, сек" hint="Основное время на один бан или пик.">
              {(id) => (
                <FormInput id={id} type="number" min={5} max={600} value={mainSec} onChange={(e) => setMainSec(e.target.value)} />
              )}
            </Field>
            <Field label="Банк, сек" hint="Доп-время команды на весь драфт.">
              {(id) => (
                <FormInput
                  id={id}
                  type="number"
                  min={0}
                  max={3600}
                  value={reserveSec}
                  onChange={(e) => setReserveSec(e.target.value)}
                />
              )}
            </Field>
          </div>

          <Field label="Встреча турнира" hint="Необязательно: лобби собирается и без турнира.">
            {(id) => (
              <FormSelect id={id} size="sm" value={seriesId} onChange={(e) => setSeriesId(e.target.value)}>
                <option value="">Без привязки</option>
                {series.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </FormSelect>
            )}
          </Field>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {[a, b].map((team, i) =>
          team ? (
            <Roster key={team.id} team={team} side={i as TeamIdx} picked={picked} onToggle={toggle} onRole={setRole} />
          ) : null,
        )}
      </div>

      <Guests people={people} teams={[a, b]} guests={guests} onChange={setGuests} />

      <div className="flex flex-wrap items-center gap-3">
        <Button tone="orange" disabled={!ready} loading={busy} onClick={submit}>
          Собрать лобби
        </Button>
        {!ready && <Alert tone="warn">Название и две разные команды.</Alert>}
        {error && <Alert tone="err">{error}</Alert>}
      </div>
    </div>
  );
}

/**
 * Позвать вне составов (ТЗ 22в §3). До 22в приглашённые брались ТОЛЬКО из составов двух команд, и
 * каждому проставлялась сторона — то есть комментатора и второго админа комнаты позвать было
 * нечем, хотя роли `caster` и `admin` в схеме есть с 22а.
 *
 * Отдельным блоком под составами, а не третьей колонкой рядом: эти люди не принадлежат ни одной
 * стороне, а колонка рядом с составами читалась бы как «ещё одна команда».
 */
function Guests({
  people,
  teams,
  guests,
  onChange,
}: {
  people: { id: number; nickname: string }[];
  /** Выбранные стороны: их состав из списка убираем — оттуда зовут галочкой выше. */
  teams: (LobbyTeam | null)[];
  guests: Guest[];
  onChange: (next: Guest[]) => void;
}) {
  const [who, setWho] = useState("");
  const [role, setRole] = useState<LobbyRole>("caster");

  const inSides = new Set(teams.flatMap((t) => t?.players.map((p) => p.id) ?? []));
  const taken = new Set(guests.map((g) => g.playerId));
  const free = people.filter((p) => !inSides.has(p.id) && !taken.has(p.id));
  const nameOf = (id: number) => people.find((p) => p.id === id)?.nickname ?? `#${id}`;

  return (
    <Card variant="tight">
      <div className="font-pouf">
        <Eyebrow>Вне составов</Eyebrow>
        <p className="mt-1 text-xs font-bold leading-[1.5] text-muted">
          ОБС и админ комнаты: стороны у них нет, готовность они не блокируют. Приглашение придёт
          так же — сообщением от Spirit CTRL.
        </p>

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <FormSelect
            size="sm"
            className="min-w-[12rem] flex-1"
            aria-label="Кого позвать"
            value={who}
            onChange={(e) => setWho(e.target.value)}
          >
            <option value="">Кого позвать…</option>
            {free.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nickname}
              </option>
            ))}
          </FormSelect>
          <FormSelect
            size="sm"
            className="w-[10rem] shrink-0"
            aria-label="Роль в комнате"
            value={role}
            onChange={(e) => setRole(e.target.value as LobbyRole)}
          >
            {GUEST_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </FormSelect>
          <Button
            size="sm"
            variant="quiet"
            disabled={!who}
            onClick={() => {
              onChange([...guests, { playerId: Number(who), role }]);
              setWho("");
            }}
          >
            Позвать
          </Button>
        </div>

        {guests.length > 0 && (
          <div className="mt-3 space-y-1">
            {guests.map((g) => (
              <div key={g.playerId} className="flex items-center gap-2.5 rounded-[12px] px-2 py-1.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-ink">{nameOf(g.playerId)}</span>
                  <span className="block truncate text-[11px] font-bold text-muted">{ROLE_LABEL[g.role]}</span>
                </span>
                <Button
                  size="sm"
                  variant="quiet"
                  tone="down"
                  onClick={() => onChange(guests.filter((x) => x.playerId !== g.playerId))}
                >
                  Убрать
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

/** Состав стороны с галочками: кого зовём и кем он будет в комнате. */
function Roster({
  team,
  side,
  picked,
  onToggle,
  onRole,
}: {
  team: LobbyTeam;
  side: TeamIdx;
  picked: Record<number, Picked>;
  onToggle: (id: number, on: boolean) => void;
  onRole: (id: number, role: LobbyRole) => void;
}) {
  const count = team.players.filter((p) => picked[p.id]?.on).length;
  const orphans = team.players.filter((p) => !p.invitable).length;
  return (
    <Card variant="tight">
      <div className="font-pouf">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-pill" style={{ background: team.color }} />
          <h2 className="min-w-0 flex-1 truncate text-[17px] font-black text-ink">{team.name}</h2>
          <span className="shrink-0 text-[11px] font-black uppercase tracking-[1px] text-muted">
            сторона {side === 0 ? "A" : "B"} · {count}
          </span>
        </div>
        <div className="mt-3 space-y-1">
          {team.players.length === 0 && <p className="text-[13px] font-bold text-muted">Состав пуст.</p>}
          {orphans > 0 && (
            <p className="pb-1 text-[11px] font-bold text-muted">
              Без аккаунта в лиге: {orphans} — их не позвать, пока они не зарегистрируются.
            </p>
          )}
          {team.players.map((p) => {
            const row = picked[p.id];
            return (
              <label
                key={p.id}
                className={`flex items-center gap-2.5 rounded-[12px] px-2 py-1.5 ${p.invitable ? "hover:bg-surface-2" : "opacity-60"}`}
              >
                <Checkbox
                  checked={!!row?.on}
                  disabled={!p.invitable}
                  onCheckedChange={(v) => onToggle(p.id, v === true)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-ink">{p.nickname}</span>
                  <span className="block truncate text-[11px] font-bold text-muted">
                    {p.invitable ? p.role : "нет аккаунта — позвать некуда"}
                  </span>
                </span>
                <FormSelect
                  size="sm"
                  className="w-[9rem] shrink-0"
                  disabled={!p.invitable}
                  value={row?.role ?? "player"}
                  onChange={(e) => onRole(p.id, e.target.value as LobbyRole)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </FormSelect>
              </label>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

/** Команда стороны. `FormSelect`, как в настройке драфта: список длинный, родной `<select>`
 *  на телефоне открывается системным барабаном. */
function SidePick({
  label,
  teams,
  value,
  onChange,
  exclude,
}: {
  label: string;
  teams: LobbyTeam[];
  value: number | null;
  onChange: (id: number) => void;
  exclude: number | null;
}) {
  return (
    <Field label={label}>
      {(id) => (
        <FormSelect id={id} size="sm" value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))}>
          {teams.map((t) => (
            <option key={t.id} value={t.id} disabled={t.id === exclude}>
              {t.name}
            </option>
          ))}
        </FormSelect>
      )}
    </Field>
  );
}
