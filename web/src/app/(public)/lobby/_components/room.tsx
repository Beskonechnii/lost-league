"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/pouf/Button";
import { Icon } from "@/components/pouf/Icon";
import { SectionHeader } from "@/components/pouf/blocks";
import { Alert, StatusPill } from "@/components/pouf/feedback";
import { Field, FormInput, FormSelect } from "@/components/pouf/Input";
import { Card } from "@/components/pouf/surface";
import { Eyebrow } from "@/components/pouf/text";
import { useChatEvents, useLive } from "@/app/_components/chat-live";
import { canNextGame, currentTeam, type TeamIdx } from "@/lib/fearless";
import {
  ROLE_LABEL,
  captainOf,
  meIn,
  roomOnly,
  sideBlocker,
  sidePlayers,
  sideReady,
  type LobbyLine,
  type LobbyMemberView,
  type LobbyRoom,
} from "@/lib/lobby-room";
import { PlayerAvatar } from "../../roster/_components/avatar";
import { FearlessRun, type LiveTurn } from "../../../(admin)/admin/fearless-draft/_components/fearless-run";
import { fmtTime, type HeroRef, type TeamRef } from "../../../(admin)/admin/fearless-draft/_components/types";
import { LobbyChat } from "./chat";
import { PHASE } from "./phase";

/**
 * Комната встречи: сбор, монетка и сам драфт руками капитанов (ТЗ 22а + 22б).
 *
 * Экран отвечает на три вопроса в этом порядке: в какой мы стадии, кто со мной в комнате, что
 * я могу нажать. Поэтому сверху стадия одной пилюлей, ниже две стороны борд-о-борд, а мои кнопки
 * живут ВНУТРИ моей стороны — они относятся к ней, а не к экрану.
 *
 * Состояние комнаты приезжает снимком по живому каналу чата (`chat-live`): своего механизма и
 * тем более опроса не заводим — в 22б цена решения секунды хода, а вкладок в комнате десятки.
 * Клиент шлёт НАМЕРЕНИЕ и ждёт снимок в ответ, а не считает новое состояние сам.
 *
 * Борд драфта — принятая раскладка 15а, взятая как есть: смотрят его все, а нажимать пул может
 * только капитан стороны, чей сейчас ход. Часы и очередь считает сервер (`lib/lobby-turn.ts`),
 * вкладка их показывает — поэтому перезагрузка страницы счётчик не обнуляет, а закрытая вкладка
 * не останавливает время.
 */

type Send = {
  intent: string;
  side?: TeamIdx;
  /** Настройки двери (42б): название, пароль и имена сторон едут одним намерением. */
  title?: string;
  password?: string;
  sideAName?: string;
  sideBName?: string;
  /** Кого зовём в комнату — приглашение адресуется игроком, а пускается аккаунт. */
  playerId?: number;
  value?: unknown;
  block?: "side" | "order";
  heroId?: number;
  /** Номер хода на карте в момент нажатия: им сервер отличает повтор от нового хода. */
  at?: number;
};

export function LobbyView({
  initial,
  me,
  admin,
  heroes,
  chat,
  obsKey,
  password,
  people,
}: {
  initial: LobbyRoom;
  me: number;
  /** Админ лиги (право `tools`) — админ комнаты, но не игрок: кнопок стороны у него нет. */
  admin: boolean;
  heroes: HeroRef[];
  /** История чата комнаты: читается из БД при рендере, дальше лента живёт живым каналом. */
  chat: LobbyLine[];
  /** Ключ ОБС-вида — только админу комнаты и ОБС. В снимке комнаты его нет намеренно: снимок
   *  один на всех участников, а ключ открывает борд без входа. */
  obsKey: string | null;
  /** Пароль двери — только админу комнаты: он его диктует и меняет. В снимке его нет по той же
   *  причине, что и ключа эфира. */
  password: string | null;
  /** Кого можно позвать: игроки лиги с аккаунтом, которых в комнате ещё нет. Пусто у всех, кроме
   *  админа комнаты. */
  people: { id: number; nickname: string }[];
}) {
  // Снимок держим вместе с моментом его получения: часы хода считает сервер, и разницу между
  // его часами и часами этой машины надо снять один раз на снимок — иначе экран с убежавшими
  // системными часами показывал бы чужое время (а решает всё равно сервер).
  const [{ room, recv }, setSnap] = useState(() => ({ room: initial, recv: Date.now() }));
  const setRoom = useCallback((r: LobbyRoom) => setSnap({ room: r, recv: Date.now() }), []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Пароль двери не ездит в снимке (он не для всех), поэтому свежее значение после правки помнит
  // сама вкладка: иначе форма перемонтировалась бы серверным — то есть уже устаревшим — паролем.
  const [pass, setPass] = useState(password ?? "");
  const { players: online } = useLive();

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/lobby/${initial.id}`);
    if (res.ok) setRoom((await res.json()) as LobbyRoom);
  }, [initial.id, setRoom]);

  const send = useCallback(
    async (body: Send) => {
      setBusy(body.intent);
      setError(null);
      try {
        const res = await fetch(`/api/lobby/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as LobbyRoom & { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Не получилось");
          return;
        }
        setRoom(data);
      } catch {
        setError("Нет связи с сервером");
      } finally {
        setBusy(null);
      }
    },
    [initial.id, setRoom],
  );

  // «Я зашёл» — факт комнаты, а не присутствия вкладки: приглашённый, не открывавший комнату,
  // и человек, закрывший её на минуту, — разные истории, и вторую в списке гасить нельзя.
  useEffect(() => {
    // Мимо `send`: тот ставит «занято» сразу в теле, а синхронный setState в эффекте — каскад
    // перерисовок. Здесь состояние меняется только в колбэке ответа.
    void fetch(`/api/lobby/${initial.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: "join" }),
    })
      .then((res) => (res.ok ? (res.json() as Promise<LobbyRoom>) : null))
      .then((data) => data && setRoom(data))
      .catch(() => {});
  }, [initial.id, setRoom]);

  useChatEvents((event) => {
    if (event.type === "lobby" && event.room.id === initial.id) setRoom(event.room);
  });

  // Живой канал рвётся (сон вкладки, мобильная сеть) и чинится сам, но пропущенные события
  // повторно не приезжают. Возврат на вкладку — единственный момент, когда это заметно, и он же
  // самый дешёвый повод перечитать снимок. Опроса при этом не появляется.
  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const mine = meIn(room, me);
  const heroById = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);
  // Карточка команды борду нужна за лого и капитаном; капитана берём из комнаты, а не из ростера:
  // в лобби капитан тот, кого выбрала сторона, а не тот, у кого галочка в составе.
  const teamRefs: TeamRef[] = useMemo(
    () =>
      room.sides.map((s, i) => {
        const cap = captainOf(room, i as TeamIdx);
        return {
          // Сторона адресуется своим номером: команды ростера за ней больше нет (42б), а борду
          // нужен лишь ключ пары «сторона A / сторона B».
          id: i,
          name: s.name,
          color: s.color,
          logo: null,
          captain: cap ? { nickname: cap.nickname, photo: cap.photo, mmr: null } : null,
        };
      }),
    [room],
  );

  const isRoomAdmin = admin || room.ownerAccountId === me;
  // Ход вносит ТОЛЬКО капитан своей стороны и только в свою очередь (решение 3). Сторона лобби
  // и индекс команды в драфте — одно число: состояние собрано из `room.sides` тем же порядком.
  // Право нажатия здесь — про экран; настоящую проверку всё равно делает сервер.
  const myTurn =
    !!room.state && !!mine?.captain && mine.side !== null && currentTeam(room.state) === mine.side;
  const moves = room.state ? (room.state.games[room.state.current]?.moves.length ?? 0) : 0;

  const live: LiveTurn | undefined = room.state
    ? {
        clock: {
          // Сдвигаем серверную отметку в часы этой вкладки: показание обязано совпадать с тем,
          // по чему сервер считает истечение, а не с системными часами машины.
          startedAt: room.turn.startedAt === null ? null : room.turn.startedAt - (room.turn.now - recv),
          reserve: room.turn.reserve,
        },
        myTurn,
        busy: busy === "pick",
        onPick: (heroId) => send({ intent: "pick", heroId, at: moves }),
        onNext: isRoomAdmin && canNextGame(room.state) ? () => send({ intent: "next" }) : null,
        autoFrom: room.turn.autoFrom,
      }
    : undefined;

  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader
        eyebrow="Лига · комната встречи"
        title={room.title}
        aside={
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill tone={PHASE[room.status].tone}>{PHASE[room.status].label}</StatusPill>
            <span className="text-[11px] font-bold text-muted">
              ход {fmtTime(room.mainSec)} · банк {fmtTime(room.reserveSec)} · Bo{room.bestOf}
            </span>
          </span>
        }
      />

      {error && <Alert tone="err">{error}</Alert>}

      {room.status === "coin" && room.coin && (
        <Coin room={room} me={me} busy={busy} onPick={(block, value) => send({ intent: "coin", block, value })} />
      )}

      {room.state && (
        <FearlessRun
          state={room.state}
          setState={() => {}}
          heroById={heroById}
          teams={teamRefs}
          readOnly
          live={live}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {([0, 1] as TeamIdx[]).map((side) => (
          <Side
            key={side}
            room={room}
            side={side}
            mine={mine}
            admin={isRoomAdmin}
            online={online}
            busy={busy}
            onSend={send}
          />
        ))}
      </div>

      {/* Чат и «кто в комнате» — один ряд под сторонами: разговор относится ко всей комнате, а не
          к стороне. В один столбец (390) «В комнате» идёт ПЕРВЫМ: это короткая справка, а чат —
          лента, в которой остаются, и держать её последней дешевле, чем листать сквозь неё. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        {/* `min-w-0` обязателен: в один столбец (390) дорожка сетки задана `auto`, а у ячейки
            `min-width: auto` — и одна ссылка без пробелов растягивала бы её вместе со всей
            страницей. От `lg` ширину держит `minmax(0,1fr)`, там это уже не видно. */}
        <div className="order-2 min-w-0 lg:order-1">
          <LobbyChat lobbyId={room.id} me={me} members={room.members} initial={chat} />
        </div>
        <div className="order-1 min-w-0 space-y-4 lg:order-2">
          <InRoom room={room} online={online} />
          {isRoomAdmin && password !== null && (
            <Door
              key={`${room.title}|${room.sides[0].name}|${room.sides[1].name}|${pass}`}
              room={room}
              password={pass}
              onSaved={setPass}
              people={people}
              busy={busy}
              onSend={send}
            />
          )}
          {obsKey && <ObsLink obsKey={obsKey} />}
        </div>
      </div>
    </div>
  );
}

/**
 * «В комнате» — участники ВНЕ сторон: админ комнаты и ОБС. До 22в их не было ни в одном списке
 * экрана (`Side` рисует только членов со `side === 0|1`), то есть создатель комнаты был в ней
 * невидим, а приглашённый ОБС был бы невидим так же.
 *
 * Отдельной карточкой, а не подвалом под сторонами: эти люди не принадлежат ни одной из них, и
 * подвал стороны сообщал бы обратное. Готовность они не блокируют — счёта здесь нет вовсе.
 */
function InRoom({ room, online }: { room: LobbyRoom; online: Set<number> }) {
  const people = roomOnly(room);
  return (
    <Card variant="tight">
      <div className="font-pouf">
        <Eyebrow>В комнате · {people.length}</Eyebrow>
        <div className="mt-2 space-y-1">
          {people.length === 0 ? (
            <p className="text-[13px] font-bold text-muted">Вне сторон никого.</p>
          ) : (
            people.map((m) => <Line key={m.id} m={m} online={online} />)
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * Дверь комнаты глазами админа (ТЗ 42б): название, пароль, имена сторон и приглашение.
 *
 * Пароль показан открытым — его диктуют голосом, и админ обязан его видеть. Смена пароля никого
 * не выбрасывает: внутри держит членство, пароль — только дверь. Имена сторон правятся до старта
 * драфта: дальше они уже уехали в эфир.
 *
 * Поля засеиваются серверными значениями через `key` снаружи: чужая правка перемонтирует форму
 * свежими значениями, а не оставит на экране мою устаревшую строку.
 */
function Door({
  room,
  password,
  people,
  busy,
  onSend,
  onSaved,
}: {
  room: LobbyRoom;
  password: string;
  people: { id: number; nickname: string }[];
  busy: string | null;
  onSend: (body: Send) => void;
  /** Новый пароль — наверх: в снимке комнаты его нет, и помнить его может только эта вкладка. */
  onSaved: (password: string) => void;
}) {
  const [title, setTitle] = useState(room.title);
  const [pass, setPass] = useState(password);
  const [sideAName, setA] = useState(room.sides[0].name);
  const [sideBName, setB] = useState(room.sides[1].name);
  const [who, setWho] = useState("");
  const gathering = room.status === "gather";

  return (
    <Card variant="tight">
      <div className="space-y-3 font-pouf">
        <div>
          <Eyebrow>Дверь комнаты</Eyebrow>
          <p className="mt-1 text-[11px] font-bold leading-[1.5] text-muted">
            Пароль диктуется игрокам: по нему они находят комнату в списке и заходят. Смена пароля
            никого из комнаты не выбрасывает.
          </p>
        </div>

        <Field label="Название">
          {(id) => <FormInput id={id} size="sm" value={title} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <Field label="Пароль">
          {(id) => <FormInput id={id} size="sm" mono value={pass} onChange={(e) => setPass(e.target.value)} />}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <Field label="Сторона A">
            {(id) => (
              <FormInput id={id} size="sm" value={sideAName} disabled={!gathering} onChange={(e) => setA(e.target.value)} />
            )}
          </Field>
          <Field label="Сторона B">
            {(id) => (
              <FormInput id={id} size="sm" value={sideBName} disabled={!gathering} onChange={(e) => setB(e.target.value)} />
            )}
          </Field>
        </div>
        {!gathering && (
          <p className="text-[11px] font-bold text-muted">Имена сторон меняются до начала драфта.</p>
        )}

        <Button
          size="sm"
          disabled={!title.trim() || !pass.trim()}
          loading={busy === "settings"}
          onClick={() => {
            onSaved(pass.trim());
            onSend({
              intent: "settings",
              title: title.trim(),
              password: pass.trim(),
              sideAName: sideAName.trim(),
              sideBName: sideBName.trim(),
            });
          }}
        >
          Сохранить
        </Button>

        <div className="border-t border-hairline pt-3">
          <Eyebrow>Пригласить</Eyebrow>
          <p className="mt-1 text-[11px] font-bold leading-[1.5] text-muted">
            Придёт сообщением от Spirit CTRL с кнопкой входа — пароль спрашивать не будут.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <FormSelect
              size="sm"
              className="min-w-[10rem] flex-1"
              aria-label="Кого позвать"
              value={who}
              onChange={(e) => setWho(e.target.value)}
            >
              <option value="">Кого позвать…</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nickname}
                </option>
              ))}
            </FormSelect>
            <Button
              size="sm"
              variant="quiet"
              disabled={!who}
              loading={busy === "invite"}
              onClick={() => {
                onSend({ intent: "invite", playerId: Number(who) });
                setWho("");
              }}
            >
              Позвать
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Адрес ОБС-вида. Виден админу комнаты и участнику с ролью ОБС, у игрока стороны его нет: ключ
 * открывает борд без входа, и раздавать его всей комнате незачем.
 *
 * Origin берём из адресной строки уже в браузере: сервер не знает, каким именем его открыли
 * (домен, туннель, localhost), а вставлять в OBS нужно ровно тот адрес, который работает.
 */
function ObsLink({ obsKey }: { obsKey: string }) {
  const field = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const path = `/overlay/lobby/${obsKey}`;
  // Абсолютный адрес дописываем прямо в поле, а не через состояние: сервер рисует тот же
  // компонент и про `window` не знает, а значение поля — это ровно «внешняя система», которую
  // эффекту и положено догонять.
  useEffect(() => {
    if (field.current) field.current.value = new URL(path, window.location.href).href;
  }, [path]);

  return (
    <Card variant="tight">
      <div className="font-pouf">
        <Eyebrow>Эфир · источник OBS</Eyebrow>
        <p className="mt-1 text-[11px] font-bold leading-[1.5] text-muted">
          Браузерный источник в сцене OBS, 1920×1080. Открывается без входа — ссылку не публикуем.
        </p>
        <FormInput
          ref={field}
          className="mt-2"
          size="sm"
          mono
          readOnly
          defaultValue={path}
          aria-label="Адрес ОБС-вида"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button
          className="mt-2"
          size="sm"
          variant="quiet"
          onClick={() => {
            const url = field.current?.value ?? path;
            void navigator.clipboard?.writeText(url).then(() => setCopied(true));
          }}
        >
          {copied ? "Скопировано" : "Скопировать ссылку"}
        </Button>
      </div>
    </Card>
  );
}

/** Одна сторона: кто в ней, кто капитан, кто готов — и мои кнопки, если сторона моя. */
function Side({
  room,
  side,
  mine,
  admin,
  online,
  busy,
  onSend,
}: {
  room: LobbyRoom;
  side: TeamIdx;
  mine: LobbyMemberView | null;
  admin: boolean;
  online: Set<number>;
  busy: string | null;
  onSend: (body: Send) => void;
}) {
  const team = room.sides[side];
  const players = sidePlayers(room, side);
  const others = room.members.filter((m) => m.side === side && m.role !== "player");
  const cap = captainOf(room, side);
  const ready = sideReady(room, side);
  const blocker = sideBlocker(room, side);
  const gathering = room.status === "gather";
  // Кнопки — только у игрока ЭТОЙ стороны. Админ комнаты и тренер смотрят (решение 3).
  const isMySide = mine?.side === side && mine.role === "player";

  return (
    <Card variant="tight">
      <div className="font-pouf">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-pill" style={{ background: team.color }} />
          <h2 className="min-w-0 flex-1 truncate text-[17px] font-black text-ink">{team.name}</h2>
          <StatusPill tone={ready ? "ok" : "neutral"}>{ready ? "сторона готова" : (blocker ?? "ждём")}</StatusPill>
        </div>

        <div className="mt-3 space-y-1">
          {players.length === 0 && <p className="text-[13px] font-bold text-muted">За сторону никого не позвали.</p>}
          {players.map((m) => (
            <Line key={m.id} m={m} online={online} />
          ))}
        </div>

        {others.length > 0 && (
          <>
            <Eyebrow className="mt-4 mb-1.5">Не в составе</Eyebrow>
            <div className="space-y-1">
              {others.map((m) => (
                <Line key={m.id} m={m} online={online} />
              ))}
            </div>
          </>
        )}

        {(isMySide || (admin && cap)) && gathering && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-hairline pt-3">
            {isMySide && !cap && (
              <Button size="sm" loading={busy === "captain"} onClick={() => onSend({ intent: "captain" })}>
                Стать капитаном
              </Button>
            )}
            {/* Перехвата нет: капитан — первый нажавший, у остальных кнопка гаснет и показывает,
                кто им стал. Иначе гонку за кнопку решала бы скорость руки. */}
            {isMySide && cap && !mine?.captain && (
              <Button size="sm" variant="quiet" disabled>
                капитан: {cap.nickname}
              </Button>
            )}
            {isMySide && mine?.captain && (
              <Button size="sm" variant="quiet" loading={busy === "resign"} onClick={() => onSend({ intent: "resign" })}>
                Отдать капитанство
              </Button>
            )}
            {isMySide && (
              <Button
                size="sm"
                variant={mine?.ready ? "quiet" : "solid"}
                tone={mine?.ready ? "purple" : "orange"}
                loading={busy === "ready"}
                onClick={() => onSend({ intent: "ready", value: !mine?.ready })}
              >
                {mine?.ready ? "Я не готов" : "Готов"}
              </Button>
            )}
            {/* Выход из тупика «капитан отвалился»: отмены и подмены хода в лобби нет, и без этой
                кнопки комната встала бы навсегда. Дальше сторона выбирает капитана заново. */}
            {admin && cap && (
              <Button
                size="sm"
                variant="quiet"
                tone="down"
                loading={busy === "unseat"}
                onClick={() => onSend({ intent: "unseat", side })}
              >
                Снять капитана
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

/** Строка участника: кто он в комнате, зашёл ли, капитан ли, готов ли. */
function Line({ m, online }: { m: LobbyMemberView; online: Set<number> }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-[12px] px-2 py-1.5 ${m.joined ? "" : "opacity-50"}`}>
      <PlayerAvatar photo={m.photo} nickname={m.nickname} size={28} shape="circle" />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-black text-ink">{m.nickname}</span>
          {m.playerId !== null && online.has(m.playerId) && (
            <span
              title="В сети"
              className="inline-block h-[9px] w-[9px] shrink-0 rounded-pill bg-[var(--up)] [box-shadow:0_0_0_2px_var(--surface)]"
            />
          )}
        </span>
        <span className="block truncate text-[11px] font-bold text-muted">
          {m.captain ? "капитан" : ROLE_LABEL[m.role]}
          {!m.joined && " · не заходил"}
        </span>
      </span>
      {m.role === "player" && (
        <span className={`shrink-0 text-[11px] font-black ${m.ready ? "text-[var(--accent-ink)]" : "text-muted"}`}>
          {m.ready ? <Icon name="ok" size="sm" /> : "ждём"}
        </span>
      )}
    </div>
  );
}

/**
 * Монетка. Результат — событие, а не строка статуса: его видят все участники разом, и тут же
 * видно, чей сейчас выбор. Победитель берёт ОДИН блок — сторону или очередь; второй достаётся
 * сопернику, и его капитан выбирает в нём значение.
 */
function Coin({
  room,
  me,
  busy,
  onPick,
}: {
  room: LobbyRoom;
  me: number;
  busy: string | null;
  onPick: (block: "side" | "order", value: TeamIdx) => void;
}) {
  const coin = room.coin!;
  const first = coin.block === null;
  const turn: TeamIdx = first ? coin.winner : ((1 - coin.winner) as TeamIdx);
  const cap = captainOf(room, turn);
  const myTurn = cap?.accountId === me;
  const names = [room.sides[0].name, room.sides[1].name] as const;
  // Свободен тот блок, который ещё не разыгран: первым выбирает победитель, второй достаётся сопернику.
  const blocks: ("side" | "order")[] = first ? ["side", "order"] : coin.block === "side" ? ["order"] : ["side"];

  return (
    <Card variant="tight">
      <div className="space-y-3 font-pouf">
        <Alert tone="info" block>
          Монетку выиграла <b>{names[coin.winner]}</b>.{" "}
          {first
            ? "Её капитан берёт один блок — сторону или очередь; второй достаётся сопернику."
            : `Блок «${coin.block === "side" ? "сторона" : "очередь"}» разыгран — оставшийся выбирает ${names[turn]}.`}
        </Alert>

        {myTurn ? (
          blocks.map((block) => (
            <div key={block}>
              <Eyebrow className="mb-1.5">{block === "side" ? "Свет (Radiant)" : "Первый пик (FP)"}</Eyebrow>
              <div className="flex flex-wrap gap-2">
                {([0, 1] as TeamIdx[]).map((v) => (
                  <Button key={v} size="sm" variant="quiet" loading={busy === "coin"} onClick={() => onPick(block, v)}>
                    {names[v]}
                  </Button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="text-[13px] font-bold text-muted">
            Ждём выбор капитана: <b className="text-ink">{cap?.nickname ?? names[turn]}</b>.
          </p>
        )}
      </div>
    </Card>
  );
}
