"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import type { SeriesRow } from "@/lib/series";
import { BRACKETS, STAGES, playoffLabel, stageLabel } from "@/lib/stages";
import { slotByKey, validScores } from "@/lib/playoff-bracket";
// Страница целиком на компонентах Кита («подушки» claymorphism).
import { Button as PoufButton } from "@/components/pouf/Button";
import { Input as PoufInput } from "@/components/pouf/Input";
import { Card } from "@/components/pouf/surface";
import { Sheet } from "@/components/pouf/sheet";
import { DropdownMenu } from "@/components/pouf/menu";
import { Segmented } from "@/components/pouf/Segmented";
import { Badge } from "@/components/pouf/media";
import { Separator } from "@/components/pouf/separator";
import { Heading, Eyebrow, Text } from "@/components/pouf/text";

// Форма и список архива. Пишет через /api/series/* — тот же путь, что и у любой правки в проекте,
// поэтому серверных экшенов здесь нет: правило «не-GET к /api закрыт паролем» одно на всё.

type TeamOpt = { id: number; name: string; tag: string; divisionId: number | null };
type DivOpt = { id: number; name: string; label: string };

/** Слот сетки для формы: подпись, команды (когда известны) и «занят ли». Считается на сервере. */
export type SlotOption = {
  key: string;
  label: string;
  round: string;
  bestOf: 3 | 5;
  aTeamId: number | null;
  bTeamId: number | null;
  aName: string;
  bName: string;
  taken: boolean;
};
/** Слоты сетки по id дивизиона: имена дивизионов в разных турнирах совпадают, id — нет. */
export type SlotOptions = Record<number, SlotOption[]>;

const SCORES = ["2:0", "2:1", "1:2", "0:2"];

const clock = (sec: number | null) => (sec ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : "—");

/** Дата в вид, который понимает <input type="datetime-local">: локальное время без зоны. */
function forInput(value: Date | string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Подпись над контролом формы — компактный uppercase-ярлык в духе pouf Field. */
function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-black uppercase tracking-[0.6px] text-muted">{label}</span>
      {children}
    </label>
  );
}

/** Select поверх pouf DropdownMenu: у них нет shadcn-подобного Select, поэтому дропдаун-меню
 *  с триггером-кнопкой, показывающей текущий выбор. Пункт с onClick проставляет значение. */
function PoufSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}) {
  const cur = options.find((o) => o.value === value);
  return (
    <DropdownMenu items={options.map((o) => ({ label: o.label, disabled: o.disabled, onClick: () => onChange(o.value) }))}>
      <PoufButton variant="quiet" size="sm">
        {cur?.label ?? placeholder ?? "—"} ▾
      </PoufButton>
    </DropdownMenu>
  );
}

// Кнопка-действие в строке архива. neutral/danger — тихий вариант (quiet), чтобы плотный список
// не превращался в стену кнопок; вооружённое удаление (armed) — громкий solid tone=down.
function ActionBtn({
  onClick,
  disabled,
  tone = "neutral",
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "danger" | "armed";
  children: React.ReactNode;
}) {
  if (tone === "armed") {
    return (
      <PoufButton variant="solid" tone="down" size="sm" onClick={onClick} disabled={disabled}>
        {children}
      </PoufButton>
    );
  }
  return (
    <PoufButton variant="quiet" size="sm" onClick={onClick} disabled={disabled}>
      {children}
    </PoufButton>
  );
}

/** Строка «привязать карту»: номер + id матча OpenDota. Стата читается сервером сразу при привязке. */
function AttachGame({ seriesId, nextNumber, onDone }: { seriesId: number; nextNumber: number; onDone: () => void }) {
  const [matchId, setMatchId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/series/${seriesId}/games`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameNumber: nextNumber, openDotaMatchId: matchId.trim() }),
    });
    const json = await res.json();
    setBusy(false);
    if (!json.ok) return setError(json.error ?? "Не вышло");
    setMatchId("");
    onDone();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <Text size="sm" muted>
        карта {nextNumber}:
      </Text>
      <div className="w-52">
        <PoufInput
          value={matchId}
          onChange={setMatchId}
          onKeyDown={(e) => e.key === "Enter" && matchId.trim() && submit()}
          placeholder="ID матча OpenDota"
          label="ID матча OpenDota"
        />
      </div>
      <PoufButton onClick={submit} disabled={!matchId.trim()} loading={busy} size="sm">
        {busy ? "Читаю…" : "Привязать"}
      </PoufButton>
      {error && (
        <span className="text-[13px] font-bold text-[var(--warn)]">{error}</span>
      )}
    </div>
  );
}

function SeriesCard({ s, onChange }: { s: SeriesRow; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Подтверждение — вторым кликом по той же кнопке, а не системным confirm(): удаляется встреча
  // вместе с картами и статой, и цена промаха выше, чем неудобство второго клика.
  const [confirming, setConfirming] = useState(false);
  // Время начала. Правится здесь, потому что отсюда о нём узнают игроки: сохранение рассылает
  // уведомление обеим командам (src/lib/tg-schedule.ts), а из него же живут напоминания.
  const [time, setTime] = useState(forInput(s.startAt));
  const [timeSaved, setTimeSaved] = useState(false);

  const resync = async (matchId: number) => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/series/${s.id}/games/${matchId}`, { method: "POST" });
    const json = await res.json().catch(() => ({ ok: res.ok }));
    setBusy(false);
    if (!json.ok) return setError(json.error ?? "Не вышло перечитать");
    onChange();
  };

  const detach = async (matchId: number) => {
    setBusy(true);
    const res = await fetch(`/api/series/${s.id}/games/${matchId}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({ ok: res.ok }));
    setBusy(false);
    if (!json.ok) return setError(json.error ?? "Не вышло отцепить");
    onChange();
  };

  const saveTime = async () => {
    setBusy(true);
    setError(null);
    setTimeSaved(false);
    const res = await fetch(`/api/series/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      // Пустое поле — «время снято»: такая встреча попадает в суточный дайджест организатору.
      body: JSON.stringify({ startAt: time || null }),
    });
    const json = await res.json().catch(() => ({ ok: res.ok }));
    setBusy(false);
    if (!json.ok) return setError(json.error ?? "Не вышло сохранить время");
    setTimeSaved(true);
    onChange();
  };

  const remove = async () => {
    if (!confirming) return setConfirming(true);
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/series/${s.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({ ok: res.ok }));
    setBusy(false);
    setConfirming(false);
    if (!json.ok) return setError(json.error ?? "Не вышло удалить");
    onChange();
  };

  // Графика серии: клон мастер-шаблона нужного типа с подставленными данными, открываем в редакторе.
  // Повторное нажатие открывает уже созданную графику (endpoint не плодит дубли).
  const makeGraphic = async (kind: "announce" | "announce2" | "score" | "result", mapNumber?: number) => {
    setBusy(true);
    setError(null);
    // окно открываем синхронно в жесте клика — иначе попап-блокер режет открытие после await;
    // так можно наделать несколько графов подряд, каждый в своей вкладке
    const win = window.open("", "_blank");
    const res = await fetch("/api/studio/series-graphic", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seriesId: s.id, kind, mapNumber }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: number; error?: string };
    setBusy(false);
    if (!res.ok || !json.id) {
      win?.close();
      return setError(json.error ?? "Не вышло собрать графику");
    }
    const url = `/studio/editor/${json.id}`;
    if (win) win.location.href = url;
    else window.open(url, "_blank"); // фолбэк, если окно не открылось
  };

  const used = new Set(s.games.map((g) => g.gameNumber));
  const nextNumber = [1, 2, 3, 4, 5].find((n) => !used.has(n)) ?? 1;
  // В плей-офф показываем подпись слота («ЧФ-1»), а не общий раунд: иначе четыре четвертьфинала
  // в списке неотличимы. Слот знает свою половину сетки, поэтому даёт полную «Верхняя · ЧФ-1».
  const cut =
    s.stage === "group" ? `Группа ${s.group ?? "—"}` : playoffLabel(s.bracket, slotByKey(s.slot)?.label ?? s.round);

  return (
    <Card variant="tight">
      {/* flex-колонка на всю высоту карточки: грид растягивает плитки до высоты
          самой высокой в ряду, а строка «Привязать» прижимается к низу (mt-auto),
          чтобы низ у всех плиток был на одной линии — без зияющей пустоты. */}
      <div className={`flex h-full flex-col ${busy ? "opacity-60" : ""}`}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="purple">{cut || stageLabel(s.stage)}</Badge>
          <Link href={`/series/${s.slug}`} className="text-[15px] font-black hover:underline">
            {s.home.name}
            <span className="mx-2 tabular-nums">
              {s.homeScore}:{s.awayScore}
            </span>
            {s.away.name}
          </Link>
          {s.guessed && <span className="text-[12px] font-bold text-[var(--warn)]">счёт под вопросом</span>}
          {s.games.length > 0 && (
            <Text size="sm" muted>
              карт: {s.games.length}
            </Text>
          )}

          <span className="ml-auto flex items-center gap-2">
            {confirming && (
              <ActionBtn tone="neutral" onClick={() => setConfirming(false)}>
                отмена
              </ActionBtn>
            )}
            <ActionBtn tone={confirming ? "armed" : "danger"} disabled={busy} onClick={remove}>
              {confirming ? "точно удалить?" : "удалить"}
            </ActionBtn>
          </span>
        </div>

        {error && <p className="mt-1 text-[13px] font-bold text-[var(--down)]">{error}</p>}

        <Separator />

        {/* Время начала: игроки узнают о встрече и о переносе только отсюда. */}
        <div className="flex flex-wrap items-center gap-2">
          <Text size="sm" muted>
            начало
          </Text>
          <div className="w-56">
            <PoufInput
              type="datetime-local"
              value={time}
              onChange={(v) => {
                setTime(v);
                setTimeSaved(false);
              }}
              label="Время начала встречи"
            />
          </div>
          <ActionBtn tone="neutral" disabled={busy || time === forInput(s.startAt)} onClick={saveTime}>
            сохранить
          </ActionBtn>
          {timeSaved && (
            <Text size="sm" muted>
              сохранено, командам ушло уведомление
            </Text>
          )}
        </div>

        <Separator />

        <div className="flex flex-wrap items-center gap-2">
          <Text size="sm" muted>
            графика
          </Text>
          <ActionBtn tone="neutral" disabled={busy} onClick={() => makeGraphic("announce")}>
            анонс
          </ActionBtn>
          <ActionBtn tone="neutral" disabled={busy} onClick={() => makeGraphic("announce2")}>
            анонс 2
          </ActionBtn>
          <ActionBtn tone="neutral" disabled={busy} onClick={() => makeGraphic("result")}>
            итог
          </ActionBtn>
        </div>

        <Separator />

        {/* Карты свёрнуты: в свёрнутом виде счёт и сколько карт, техчасть каждой карты
            (перечитать, отцепить, графика) — по клику. Раньше всё было развёрнуто всегда, и
            список встреч не помещался на экран. */}
        <details className="group/games">
          <summary className="flex cursor-pointer flex-wrap items-center gap-2">
            <Text size="sm" muted>
              {s.games.length === 0 ? "карт нет — стата в рейтинги не идёт" : `карт: ${s.games.length}`}
            </Text>
            <span className="text-[13px] font-bold tabular-nums text-[var(--accent-ink)]">
              {s.homeScore}:{s.awayScore}
            </span>
            {s.games.length > 0 && (
              <span className="text-[13px] font-bold text-[var(--accent-ink)]">
                <span className="group-open/games:hidden">развернуть</span>
                <span className="hidden group-open/games:inline">свернуть</span>
              </span>
            )}
          </summary>

          <div className="mt-2 space-y-2">
          {s.games.map((g) => (
            <div key={g.matchId} className="flex flex-wrap items-center gap-2">
              <span className="w-14 shrink-0">
                <Text size="sm" muted>
                  карта {g.gameNumber ?? "?"}
                </Text>
              </span>
              {g.openDotaMatchId ? (
                <Link href={`/match/${g.openDotaMatchId}`} className="text-[13px] font-bold text-[var(--accent-ink)] hover:underline">
                  #{g.openDotaMatchId}
                </Link>
              ) : (
                <Text size="sm" muted>
                  без id
                </Text>
              )}
              <Text size="sm" muted num>
                {clock(g.durationSec)}
              </Text>
              {g.statsCount ? (
                <Text size="sm" muted>
                  стата: {g.statsCount} игроков
                </Text>
              ) : (
                <span className="text-[13px] font-bold text-[var(--warn)]">стата не легла — игроков нет в ростере</span>
              )}
              <span className="ml-auto flex items-center gap-2">
                {/* счёт серии на момент этой карты (накопительный): графика-заглушка между картами */}
                {g.gameNumber != null && (
                  <ActionBtn tone="neutral" disabled={busy} onClick={() => makeGraphic("score", g.gameNumber!)}>
                    счёт
                  </ActionBtn>
                )}
                {/* пост-гейм скорборд карты в студии: матч уже выбран, борд соберётся из отчёта */}
                {g.openDotaMatchId && (
                  <ActionBtn
                    tone="neutral"
                    disabled={busy}
                    onClick={() => window.open(`/studio/new/postgame-board?match=${g.matchId}`, "_blank")}
                  >
                    скорборд
                  </ActionBtn>
                )}
                {/* отчёт дозревает: непарсенный матч позже обрастает вардами и таймингами */}
                <ActionBtn tone="neutral" disabled={busy} onClick={() => resync(g.matchId)}>
                  перечитать
                </ActionBtn>
                <ActionBtn tone="danger" disabled={busy} onClick={() => detach(g.matchId)}>
                  отцепить
                </ActionBtn>
              </span>
            </div>
          ))}
          </div>
        </details>

        {s.games.length < 5 && (
          <div className="mt-auto pt-1">
            <AttachGame seriesId={s.id} nextNumber={nextNumber} onDone={onChange} />
          </div>
        )}
      </div>
    </Card>
  );
}

/** Порядок половин сетки для сортировки плей-оффа: верхняя → нижняя → гранд. */
const bracketOrder = (b: string | null) => BRACKETS.findIndex((x) => x.key === b);

export function SeriesAdmin({
  divisions,
  statsHref,
  teams,
  series,
  slots,
  tournamentName,
}: {
  divisions: DivOpt[];
  /** Куда ведёт «статистика»: раздел дивизиона живёт внутри турнира, слаг знает только сервер. */
  statsHref: string;
  teams: TeamOpt[];
  series: SeriesRow[];
  slots: SlotOptions;
  /** Чей это архив — подпись над списком: страница открыта из блока конкретного турнира. */
  tournamentName?: string;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  // Дивизион — верхняя вкладка (как в ростере команд): D1 и D2 играют раздельно, поэтому список
  // всегда показывает ровно один дивизион. Он же — дивизион по умолчанию в форме новой встречи.
  const [division, setDivision] = useState(divisions[0]?.id ?? 0);
  const [stage, setStage] = useState<string>("group");
  const [group, setGroup] = useState("A");
  const [slot, setSlot] = useState("");
  const [homeId, setHomeId] = useState("");
  const [awayId, setAwayId] = useState("");
  const [score, setScore] = useState(SCORES[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Слоты сетки выбранного дивизиона и выбранный слот; счёт ограничен его Bo (гранд-финал — Bo5).
  const divSlots = slots[division] ?? [];
  const selSlot = divSlots.find((s) => s.key === slot) ?? null;
  const scoreOptions = stage === "playoff" && selSlot ? validScores(selSlot.bestOf) : SCORES;

  // Выбор слота подставляет команды из сетки (когда исход предыдущего раунда уже известен) —
  // оператору остаётся только счёт. Счёт сбрасываем на первый допустимый для Bo слота.
  const pickSlot = (key: string) => {
    setSlot(key);
    const s = divSlots.find((x) => x.key === key);
    if (s) {
      if (s.aTeamId) setHomeId(String(s.aTeamId));
      if (s.bTeamId) setAwayId(String(s.bTeamId));
      setScore(validScores(s.bestOf)[0]);
    }
  };
  // Форма новой встречи держалась раскрытой всегда и занимала пол-экрана над списком, ради которого
  // сюда и приходят. Прячем её за кнопку и показываем боковым sheet по клику.
  const [showForm, setShowForm] = useState(false);

  // Команды показываем только своего дивизиона: D1 и D2 играют раздельно, перемешать их — ошибка.
  const options = teams.filter((t) => !t.divisionId || t.divisionId === division);

  const create = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        divisionId: division,
        stage,
        group: stage === "group" ? group : null,
        slot: stage === "playoff" ? slot : null,
        homeId: Number(homeId),
        awayId: Number(awayId),
        score,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!json.ok) return setError(json.error ?? "Не вышло");
    setHomeId("");
    setAwayId("");
    setShowForm(false);
    refresh();
  };

  // Встреч под сотню (вся групповая стадия двух дивизионов), поэтому список без разбивки
  // бесполезен: оператор приходит сюда за одной конкретной серией.
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "withGames" | "empty">("all");
  // Подраздел внутри дивизиона: группа A/B, плей-офф — или всё, что не легло в них («Прочее»).
  // Набор вкладок строится из данных, поэтому новая группа или стадия появляется в интерфейсе сама.
  const [sub, setSub] = useState<string>("g:A");

  const textMatch = (s: SeriesRow) => {
    if (only === "withGames" && s.games.length === 0) return false;
    if (only === "empty" && s.games.length > 0) return false;
    if (!q.trim()) return true;
    const text = `${s.home.name} ${s.away.name} ${s.home.tag} ${s.away.tag} ${s.round ?? ""}`.toLowerCase();
    return text.includes(q.trim().toLowerCase());
  };

  // Встречи активного дивизиона — база для вкладок подраздела и для списка.
  const inDivision = series.filter((s) => s.divisionId === division);

  // Вкладки подраздела строим по факту: сколько групп есть — столько вкладок «Группа X»,
  // плюс «Плей-офф», плюс «Прочее» для всего, что не групповая стадия и не плей-офф.
  const isOther = (s: SeriesRow) => s.stage !== "group" && s.stage !== "playoff";
  const groups = [...new Set(inDivision.filter((s) => s.stage === "group").map((s) => s.group ?? "—"))].sort();
  const subTabs = [
    ...groups.map((g) => ({ key: `g:${g}`, label: `Группа ${g}`, test: (s: SeriesRow) => s.stage === "group" && (s.group ?? "—") === g })),
    ...(inDivision.some((s) => s.stage === "playoff") ? [{ key: "playoff", label: "Плей-офф", test: (s: SeriesRow) => s.stage === "playoff" }] : []),
    ...(inDivision.some(isOther) ? [{ key: "other", label: "Прочее", test: isOther }] : []),
  ];
  const activeSub = subTabs.find((t) => t.key === sub) ?? subTabs[0];

  // Список: встречи активного дивизиона и подраздела, прошедшие текст-фильтр. Плей-офф сортируем
  // по половине сетки (верхняя → нижняя → гранд), чтобы стадии шли в турнирном порядке.
  const rows = inDivision
    .filter((s) => (activeSub ? activeSub.test(s) : true) && textMatch(s))
    .sort((a, b) => (activeSub?.key === "playoff" ? bracketOrder(a.bracket) - bracketOrder(b.bracket) : 0));

  const onlyOptions: { value: "all" | "withGames" | "empty"; label: string }[] = [
    { value: "all", label: "Все" },
    { value: "withGames", label: "С картами" },
    { value: "empty", label: "Без карт" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Служебная часть · архив{tournamentName ? ` · ${tournamentName}` : ""}</Eyebrow>
          <Heading level={1}>{tournamentName ?? "Архив серий"}</Heading>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Text size="sm" muted>
            Карты отсюда идут в{" "}
            <Link href={statsHref} className="font-bold text-[var(--accent-ink)] hover:underline">
              статистику
            </Link>
          </Text>
          <PoufButton
            onClick={() => {
              setError(null);
              setShowForm(true);
            }}
          >
            + Завести встречу
          </PoufButton>
        </div>
      </div>

      {/* Форма новой встречи — боковой pouf Sheet: Esc, фокус-ловушка и крестик из коробки (Radix Dialog).
          Поля стоят в столбик — панель уже центральной модалки. */}
      <Sheet open={showForm} onOpenChange={setShowForm} title="Новая встреча">
        <div className="flex flex-col gap-4">
          <Labeled label="Дивизион">
            <PoufSelect
            value={String(division)}
            onChange={(v) => setDivision(Number(v))}
            options={divisions.map((d) => ({ value: String(d.id), label: d.label }))}
          />
          </Labeled>
          <Labeled label="Стадия">
            <PoufSelect
              value={stage}
              onChange={(v) => {
                setStage(v);
                // При переходе в плей-офф сразу берём первый свободный слот сетки — с командами.
                if (v === "playoff" && !slot) pickSlot((divSlots.find((s) => !s.taken) ?? divSlots[0])?.key ?? "");
              }}
              options={STAGES.map((s) => ({ value: s.key, label: s.label }))}
            />
          </Labeled>
          {stage === "group" ? (
            <Labeled label="Группа">
              <PoufSelect value={group} onChange={setGroup} options={["A", "B"].map((g) => ({ value: g, label: g }))} />
            </Labeled>
          ) : (
            <Labeled label="Слот сетки">
              {/* половину сетки и раунд не спрашиваем: их задаёт слот (см. src/lib/playoff-bracket.ts) */}
              <PoufSelect
                value={slot}
                onChange={pickSlot}
                placeholder="—"
                options={divSlots.map((s) => ({ value: s.key, label: `${s.label} · ${s.aName} — ${s.bName}${s.taken ? " (занят)" : ""}` }))}
              />
            </Labeled>
          )}
          <Labeled label="Хозяева">
            <PoufSelect value={homeId} onChange={setHomeId} placeholder="—" options={options.map((t) => ({ value: String(t.id), label: t.name }))} />
          </Labeled>
          <Labeled label="Счёт">
            <PoufSelect value={score} onChange={setScore} options={scoreOptions.map((s) => ({ value: s, label: s }))} />
          </Labeled>
          <Labeled label="Гости">
            <PoufSelect value={awayId} onChange={setAwayId} placeholder="—" options={options.map((t) => ({ value: String(t.id), label: t.name }))} />
          </Labeled>
          <div className="pt-1">
            <PoufButton block onClick={create} disabled={!homeId || !awayId || (stage === "playoff" && !slot)} loading={busy}>
              {busy ? "…" : "Завести"}
            </PoufButton>
          </div>
          {error && <span className="text-[13px] font-bold text-[var(--down)]">{error}</span>}
        </div>
      </Sheet>

      {/* Дивизион слева крупным Segmented, поиск и фильтр карт — справа. */}
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={String(division)}
          onChange={(v) => setDivision(Number(v))}
          label="Дивизион"
          tone="purple"
          options={divisions.map((d) => ({
            value: String(d.id),
            label: `${d.label}  ${series.filter((s) => s.divisionId === d.id).length}`,
          }))}
        />
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <div className="w-56">
            <PoufInput value={q} onChange={setQ} placeholder="Поиск по командам" label="Поиск по командам" />
          </div>
          <Segmented value={only} onChange={setOnly} label="Фильтр карт" options={onlyOptions} tone="blue" />
        </div>
      </div>

      {/* Подраздел внутри дивизиона: группы и плей-офф. Счётчик — по дивизиону, без учёта текста. */}
      <div>
        {subTabs.length === 0 ? (
          <Text size="sm" muted>
            В дивизионе пока нет встреч.
          </Text>
        ) : (
          <Segmented
            value={activeSub?.key ?? sub}
            onChange={setSub}
            label="Раздел"
            tone="purple"
            options={subTabs.map((t) => ({ value: t.key, label: `${t.label}  ${inDivision.filter(t.test).length}` }))}
          />
        )}
      </div>

      {/* Плитки в адаптивной сетке: 1 колонка на узком, 2 на среднем, 3 на широком.
          Без items-start — грид растягивает плитки в ряду до общей высоты (однородный вид);
          строку «Привязать» внутри карточки прижимает к низу mt-auto. */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.length === 0 ? (
          <div className="col-span-full">
            <Text size="sm" muted>
              Пусто — ни одной встречи в этом разделе.
            </Text>
          </div>
        ) : (
          // Время начала в ключе: поле «начало» — состояние карточки, и после апрува предложения
          // капитанов (оно приходит с сервера, а не из этой формы) карточка обязана перечитать его.
          // Иначе поле остаётся пустым, а «сохранить» рядом с ним снесло бы только что назначенное.
          rows.map((s) => <SeriesCard key={`${s.id}:${s.startAt?.getTime() ?? 0}`} s={s} onChange={refresh} />)
        )}
      </div>
    </div>
  );
}
