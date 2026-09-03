"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageField, SaveButton, SelectField, TextAreaField, TextField, Label } from "./form";
import { Button } from "@/components/pouf/Button";
import { Input } from "@/components/pouf/Input";
import { Checkbox } from "@/components/pouf/checkbox";
import { ROLES } from "@/lib/roles";
import { PLAYER_TAGS, parseTags } from "@/lib/player-tags";

// Формы профилей. Значения приходят из серверной страницы, изменения уходят в /api/studio/*.

type TeamForm = {
  name: string;
  tag: string;
  group: string;
  color: string;
  logo: string | null;
  wordmark: string | null;
  photo: string | null;
  banner: string | null;
};

export function TeamEditor({ id, initial }: { id: number; initial: TeamForm }) {
  const [v, setV] = useState(initial);
  const set = <K extends keyof TeamForm>(k: K, val: TeamForm[K]) => setV((p) => ({ ...p, [k]: val }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Название" value={v.name} onChange={(x) => set("name", x)} />
        <TextField label="Тег" value={v.tag} onChange={(x) => set("tag", x)} placeholder="MLK" />
        <TextField label="Дивизион / группа" value={v.group} onChange={(x) => set("group", x)} placeholder="Division 1" />
        <label className="block">
          <Label>Акцентный цвет</Label>
          <div className="flex gap-2">
            <input
              type="color"
              value={v.color || "#a855f7"}
              onChange={(e) => set("color", e.target.value)}
              className="h-[52px] w-14 shrink-0 rounded-control bg-bg cushion-field"
            />
            <Input value={v.color} placeholder="#A855F7" onChange={(x) => set("color", x)} />
          </div>
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <ImageField label="Логотип" kind="teams" value={v.logo} onChange={(x) => set("logo", x)} hint="Эмблема, PNG с прозрачностью" />
        <ImageField label="Wordmark" kind="teams" value={v.wordmark} onChange={(x) => set("wordmark", x)} hint="Надпись-граффити для анонсов" />
        <ImageField label="Фото команды" kind="teams" value={v.photo} onChange={(x) => set("photo", x)} hint="Кадр в рамку VS-анонса" />
        <ImageField label="Баннер" kind="teams" value={v.banner} onChange={(x) => set("banner", x)} hint="Широкая подложка шапки страницы команды" />
      </div>

      <SaveButton url={`/api/roster/teams/${id}`} data={v} />
    </div>
  );
}

// Карточка игрока — про человека. Команда, роль и капитанство лежат на месте в составе,
// потому что у одного человека их может быть несколько (см. SpotsEditor ниже).
type PlayerForm = {
  nickname: string;
  realName: string;
  accountId: string;
  mmr: string;
  telegram: string;
  birthday: string;
  city: string;
  country: string;
  photo: string | null;
  banner: string | null;
  interviewUrl: string;
  orderNo: string;
  achievements: string;
  tags: string; // ключи ролей через запятую (см. player-tags.ts)
};

function Fieldset({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card bg-surface p-5 font-pouf cushion-card">
      <h3 className="mb-3 text-[13px] font-extrabold uppercase tracking-[1.5px] text-muted">{title}</h3>
      {children}
    </section>
  );
}

export function PlayerEditor({ id, initial }: { id: number; initial: PlayerForm }) {
  const [v, setV] = useState(initial);
  const set = <K extends keyof PlayerForm>(k: K, val: PlayerForm[K]) => setV((p) => ({ ...p, [k]: val }));

  // Плашки-роли — мультивыбор: строка «player,caster» ↔ набор чекбоксов справочника.
  const active = new Set(parseTags(v.tags));
  const toggleTag = (key: string) => {
    const next = new Set(active);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    set("tags", PLAYER_TAGS.filter((t) => next.has(t.key)).map((t) => t.key).join(","));
  };

  return (
    <div className="space-y-4">
      {/* Личное и игровое разведены: анкету из CRM заполняют одни люди, account_id и MMR — другие */}
      <Fieldset title="Человек">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField label="Ник" value={v.nickname} onChange={(x) => set("nickname", x)} />
          <TextField label="Имя" value={v.realName} onChange={(x) => set("realName", x)} />
          <TextField label="Дата рождения" type="date" value={v.birthday} onChange={(x) => set("birthday", x)} />
          <TextField label="Город" value={v.city} onChange={(x) => set("city", x)} placeholder="Минск" />
          <TextField label="Страна" value={v.country} onChange={(x) => set("country", x)} placeholder="Беларусь" />
          <TextField
            label="Telegram"
            value={v.telegram}
            onChange={(x) => set("telegram", x)}
            placeholder="@nick"
            hint="Можно вставить ссылку t.me — сохраним хендл"
          />
        </div>
      </Fieldset>

      <Fieldset title="Игра">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            label="Dota account_id"
            value={v.accountId}
            onChange={(x) => set("accountId", x)}
            placeholder="123456789"
            hint="Или ссылка на steamcommunity.com/profiles/… — id вытащим сами"
          />
          <TextField label="MMR" value={v.mmr} onChange={(x) => set("mmr", x)} placeholder="7000" />
        </div>
      </Fieldset>

      <Fieldset title="Лига">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField label="Порядковый номер" value={v.orderNo} onChange={(x) => set("orderNo", x)} placeholder="1" hint="Перекрывает номер в шапке профиля; пусто — номер по id" />
          <TextField label="Ссылка на интервью" value={v.interviewUrl} onChange={(x) => set("interviewUrl", x)} placeholder="https://…" />
        </div>
        <div className="mt-4">
          <Label>Роли в лиге</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {PLAYER_TAGS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => toggleTag(t.key)}
                className={`rounded-[14px] px-3.5 py-[7px] text-[13px] font-black transition-[box-shadow,transform,background] ${
                  active.has(t.key)
                    ? "bg-accent-fill text-[var(--on-accent)] cushion-control"
                    : "bg-surface text-ink-muted cushion-field hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <TextAreaField
            label="Достижения"
            value={v.achievements}
            onChange={(x) => set("achievements", x)}
            placeholder={"Топ-4 LOST S1\nMVP гранд-финала\n…"}
            rows={4}
          />
          <p className="mt-1 text-xs text-ink-subtle">Одна строка — одно достижение.</p>
        </div>
      </Fieldset>

      <Fieldset title="Фото">
        <div className="grid gap-5 sm:grid-cols-2">
          <ImageField label="Портрет" kind="players" value={v.photo} onChange={(x) => set("photo", x)} hint="Для плашек и анонсов" />
          <ImageField label="Баннер" kind="players" value={v.banner} onChange={(x) => set("banner", x)} hint="Широкая подложка шапки профиля" />
        </div>
      </Fieldset>

      <SaveButton url={`/api/roster/players/${id}`} data={v} />
    </div>
  );
}

export type SpotView = { id: number; teamId: number; teamName: string; role: string; isCaptain: boolean };

const ROLE_OPTIONS = [
  { value: "", label: "— не задана —" },
  ...ROLES.map((r) => ({ value: r.key, label: r.position ? `${r.label} (поз. ${r.position})` : r.label })),
];

/**
 * Места игрока в составах. Их может быть несколько: действующим — только в одной команде,
 * заменой или тренером — где угодно. Правило проверяет сервер, здесь только показываем отказ.
 */
export function SpotsEditor({
  playerId,
  spots,
  teams,
}: {
  playerId: number;
  spots: SpotView[];
  teams: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newTeam, setNewTeam] = useState("");
  const [newRole, setNewRole] = useState("standin");

  async function send(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? "Не удалось сохранить");
      router.refresh(); // откатываем селект к тому, что реально в базе
      return;
    }
    router.refresh();
  }

  const free = teams.filter((t) => !spots.some((s) => s.teamId === t.id));

  return (
    <div className="space-y-3 font-pouf">
      {spots.length === 0 && <p className="text-sm font-bold text-muted">Игрок не числится ни в одном составе.</p>}

      {spots.map((s) => (
        <div key={s.id} className="flex flex-wrap items-end gap-3 rounded-card bg-surface p-4 cushion-row">
          <div className="min-w-40 flex-1 text-sm font-black text-ink">{s.teamName}</div>
          <div className="w-56">
            <SelectField
              label="Роль"
              value={s.role}
              onChange={(x) => void send(`/api/roster/spots/${s.id}`, "PATCH", { role: x })}
              options={ROLE_OPTIONS}
            />
          </div>
          <label className="flex items-center gap-2 pb-3 text-sm font-bold text-ink-muted">
            <Checkbox
              checked={s.isCaptain}
              onCheckedChange={(v) => void send(`/api/roster/spots/${s.id}`, "PATCH", { isCaptain: v === true })}
            />
            Капитан
          </label>
          <Button type="button" variant="quiet" tone="down" disabled={busy} onClick={() => void send(`/api/roster/spots/${s.id}`, "DELETE")}>
            Убрать
          </Button>
        </div>
      ))}

      {free.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-card bg-surface p-4 cushion-field">
          <div className="w-56">
            <SelectField
              label="Добавить в состав"
              value={newTeam}
              onChange={setNewTeam}
              options={[{ value: "", label: "— выберите команду —" }, ...free.map((t) => ({ value: String(t.id), label: t.name }))]}
            />
          </div>
          <div className="w-56">
            <SelectField label="Роль" value={newRole} onChange={setNewRole} options={ROLE_OPTIONS} />
          </div>
          <Button
            type="button"
            disabled={busy || !newTeam}
            onClick={() => void send("/api/roster/spots", "POST", { playerId, teamId: Number(newTeam), role: newRole })}
          >
            Добавить
          </Button>
        </div>
      )}

      {error && <p className="text-sm font-bold text-rose-700">{error}</p>}
    </div>
  );
}

