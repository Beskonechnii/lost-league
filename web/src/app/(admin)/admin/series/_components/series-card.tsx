"use client";

import { useState } from "react";
import Link from "next/link";
import type { SeriesRow } from "@/lib/series";
import { playoffLabel, stageLabel } from "@/lib/stages";
import { slotByKey } from "@/lib/playoff-bracket";
import { Button } from "@/components/pouf/Button";
import { FormInput, Label } from "@/components/pouf/Input";
import { Card } from "@/components/pouf/surface";
import { Chip } from "@/components/pouf/blocks";
import { Alert } from "@/components/pouf/feedback";
import { forInput } from "./types";

/* Карточка одной встречи в архиве: счёт, время начала, графика, карты и их техчасть.
 *
 * Отделена от оболочки списка при разборе `series-admin.tsx` (679 строк → четыре файла,
 * `RELEASE-PLAN.md` §C4). Граница проведена по состоянию: у карточки своё — время, ошибка,
 * «точно удалить?»; у оболочки — фильтры и вкладки. Пока они жили в одном файле, читать
 * пришлось всё разом ради любой правки.
 *
 * Пишет через /api/series/* — тот же путь, что и у любой правки в проекте, поэтому серверных
 * экшенов здесь нет: правило «не-GET к /api закрыт паролем» одно на всё.
 */

const clock = (sec: number | null) => (sec ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : "—");

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
    <div className="flex flex-wrap items-end gap-2 pt-1 font-pouf">
      <div className="min-w-[11rem] flex-1">
        <Label htmlFor={`attach-${seriesId}`}>карта {nextNumber}</Label>
        <FormInput
          id={`attach-${seriesId}`}
          size="sm"
          value={matchId}
          onChange={(e) => setMatchId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && matchId.trim() && submit()}
          placeholder="ID матча OpenDota"
          className="mt-1.5"
        />
      </div>
      <Button onClick={submit} disabled={!matchId.trim()} loading={busy} size="sm">
        {busy ? "Читаю…" : "Привязать"}
      </Button>
      {error && <Alert tone="err">{error}</Alert>}
    </div>
  );
}

export function SeriesCard({ s, onChange }: { s: SeriesRow; onChange: () => void }) {
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
      <div className={`flex h-full flex-col gap-3 font-pouf ${busy ? "opacity-60" : ""}`}>
        <div className="flex flex-wrap items-center gap-2">
          <Chip accent>{cut || stageLabel(s.stage)}</Chip>
          <Link href={`/series/${s.slug}`} className="text-[15px] font-black text-ink hover:underline">
            {s.home.name}
            <span className="mx-2 tabular-nums">
              {s.homeScore}:{s.awayScore}
            </span>
            {s.away.name}
          </Link>
          {s.guessed && <Chip>счёт под вопросом</Chip>}

          <span className="ml-auto flex items-center gap-2">
            {confirming && (
              <Button variant="quiet" size="xs" onClick={() => setConfirming(false)}>
                отмена
              </Button>
            )}
            <Button
              variant={confirming ? "solid" : "quiet"}
              tone={confirming ? "down" : undefined}
              size="xs"
              disabled={busy}
              onClick={remove}
            >
              {confirming ? "точно удалить?" : "удалить"}
            </Button>
          </span>
        </div>

        {error && <Alert tone="err" block>{error}</Alert>}

        {/* Время начала: игроки узнают о встрече и о переносе только отсюда. */}
        <div className="flex flex-wrap items-end gap-2 border-t border-hairline pt-3">
          <div className="min-w-[13rem] flex-1">
            <Label htmlFor={`start-${s.id}`}>начало</Label>
            <FormInput
              id={`start-${s.id}`}
              type="datetime-local"
              size="sm"
              value={time}
              onChange={(e) => {
                setTime(e.target.value);
                setTimeSaved(false);
              }}
              className="mt-1.5"
            />
          </div>
          <Button variant="quiet" size="sm" disabled={busy || time === forInput(s.startAt)} onClick={saveTime}>
            сохранить
          </Button>
          {timeSaved && <Alert tone="ok">командам ушло уведомление</Alert>}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
          <span className="text-[13px] font-bold text-muted">графика</span>
          <Button variant="quiet" size="xs" disabled={busy} onClick={() => makeGraphic("announce")}>
            анонс
          </Button>
          <Button variant="quiet" size="xs" disabled={busy} onClick={() => makeGraphic("announce2")}>
            анонс 2
          </Button>
          <Button variant="quiet" size="xs" disabled={busy} onClick={() => makeGraphic("result")}>
            итог
          </Button>
        </div>

        {/* Карты свёрнуты: в свёрнутом виде счёт и сколько карт, техчасть каждой карты
            (перечитать, отцепить, графика) — по клику. Раньше всё было развёрнуто всегда, и
            список встреч не помещался на экран. */}
        <details className="group/games border-t border-hairline pt-3">
          <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-[13px] font-bold text-muted">
            {s.games.length === 0 ? "карт нет — стата в рейтинги не идёт" : `карт: ${s.games.length}`}
            <span className="font-black tabular-nums text-[var(--accent-ink)]">
              {s.homeScore}:{s.awayScore}
            </span>
            {s.games.length > 0 && (
              <span className="font-black text-[var(--accent-ink)]">
                <span className="group-open/games:hidden">развернуть</span>
                <span className="hidden group-open/games:inline">свернуть</span>
              </span>
            )}
          </summary>

          <div className="mt-2 space-y-2">
            {s.games.map((g) => (
              <div key={g.matchId} className="flex flex-wrap items-center gap-2 text-[13px] font-bold text-muted">
                <span className="w-14 shrink-0">карта {g.gameNumber ?? "?"}</span>
                {g.openDotaMatchId ? (
                  <Link href={`/match/${g.openDotaMatchId}`} className="text-[var(--accent-ink)] hover:underline">
                    #{g.openDotaMatchId}
                  </Link>
                ) : (
                  <span>без id</span>
                )}
                <span className="tabular-nums">{clock(g.durationSec)}</span>
                {g.statsCount ? (
                  <span>стата: {g.statsCount} игроков</span>
                ) : (
                  <span className="text-[var(--color-warn-ink)]">стата не легла — игроков нет в ростере</span>
                )}
                <span className="ml-auto flex items-center gap-2">
                  {/* счёт серии на момент этой карты (накопительный): графика-заглушка между картами */}
                  {g.gameNumber != null && (
                    <Button variant="quiet" size="xs" disabled={busy} onClick={() => makeGraphic("score", g.gameNumber!)}>
                      счёт
                    </Button>
                  )}
                  {/* пост-гейм скорборд карты в студии: матч уже выбран, борд соберётся из отчёта */}
                  {g.openDotaMatchId && (
                    <Button
                      variant="quiet"
                      size="xs"
                      disabled={busy}
                      onClick={() => window.open(`/studio/new/postgame-board?match=${g.matchId}`, "_blank")}
                    >
                      скорборд
                    </Button>
                  )}
                  {/* отчёт дозревает: непарсенный матч позже обрастает вардами и таймингами */}
                  <Button variant="quiet" size="xs" disabled={busy} onClick={() => resync(g.matchId)}>
                    перечитать
                  </Button>
                  <Button variant="quiet" size="xs" disabled={busy} onClick={() => detach(g.matchId)}>
                    отцепить
                  </Button>
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
