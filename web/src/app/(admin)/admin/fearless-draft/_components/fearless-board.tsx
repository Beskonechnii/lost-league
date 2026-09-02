"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { FormInput } from "@/components/pouf/Input";
import { StatusPill } from "@/components/pouf/feedback";
import { Toolbar, ToolbarCount, ToolbarSearch } from "@/components/pouf/toolbar";
import type { FearlessState } from "@/lib/fearless";
import { FearlessRun } from "./fearless-run";
import { FearlessSetup } from "./fearless-setup";
import type { HeroRef, TeamRef } from "./types";

/* Борд fearless-драфта — оболочка: состояние сессии, автосейв, полоса сессии, выбор экрана.
 *
 * Э11b (§C4/§C5 RELEASE-PLAN): файл был на 433 строки и держал в себе весь инструмент разом —
 * настройку с монеткой, таймеры, расписание карты, пул героев и запись прошлых карт. Части
 * разъехались по соседям (`fearless-setup`, `fearless-run`, `sequence`, `hero-pool`,
 * `past-maps`, `types`) по той же границе, что на Э9 и Э11a: здесь остаётся то, что знает
 * про сессию целиком, там — то, что знает про ход карты.
 *
 * Пустой (или несовместимой версии) payload — это ещё не начатый драфт: показываем настройку.
 */

export function FearlessBoard({
  teams,
  heroes,
  sessionId,
  initialTitle = null,
  initialState = null,
}: {
  teams: TeamRef[];
  heroes: HeroRef[];
  sessionId?: number;
  initialTitle?: string | null;
  initialState?: FearlessState | null;
}) {
  const heroById = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);
  const [state, setState] = useState<FearlessState | null>(initialState);
  const [title, setTitle] = useState(initialTitle ?? "");
  const [saving, setSaving] = useState<"idle" | "saving" | "error">("idle");

  // Автосейв через очередь — тот же приём, что на борде UNDERBEER (Э11a): PATCH'и уходят строго
  // по одному, и в полёте всегда только ПОСЛЕДНЕЕ состояние. До Э11b автосейв висел эффектом на
  // `state`, и два быстрых бана давали два независимых запроса: поздно прилетевший ранний
  // перезаписывал финал, то есть драфт откатывался назад сам по себе.
  const pending = useRef<FearlessState | null | undefined>(undefined);
  const flushing = useRef(false);
  const save = useCallback(
    (next: FearlessState | null) => {
      if (!sessionId) return;
      pending.current = next;
      if (flushing.current) return; // уже сохраняем — новое состояние подхватит текущий цикл
      flushing.current = true;
      void (async () => {
        setSaving("saving");
        try {
          while (pending.current !== undefined) {
            const body = pending.current;
            pending.current = undefined;
            const res = await fetch(`/api/fearless/${sessionId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ payload: body }), // null — сброс борда к экрану настройки
            });
            if (!res.ok) throw new Error(await res.text());
          }
          setSaving("idle");
        } catch {
          setSaving("error"); // сеть моргнула — состояние в UI цело, повторится следующим ходом
        } finally {
          flushing.current = false;
        }
      })();
    },
    [sessionId],
  );

  // Ход драфта: сначала в UI, потом в архив. Экраны борда зовут только это.
  const apply = useCallback(
    (next: FearlessState) => {
      setState(next);
      save(next);
    },
    [save],
  );

  // Сброс к экрану настройки. Чистим и архив (payload: null), иначе перезагрузка страницы
  // возвращала бы брошенный драфт — кнопка выглядела бы работающей ровно до F5.
  const reset = useCallback(() => {
    setState(null);
    save(null);
  }, [save]);

  const saveTitle = useCallback(
    (value: string) => {
      if (!sessionId) return;
      fetch(`/api/fearless/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: value }),
      }).catch(() => {});
    },
    [sessionId],
  );

  return (
    // Настройка — колонка формы, а не вся ширина сайта: там пять контролов, растянутые на
    // 1600px они превращаются в редкий частокол. Драфту, наоборот, нужна вся ширина.
    <div className={`space-y-4 ${state ? "" : "mx-auto max-w-3xl"}`}>
      {/* Полоса сессии: имя драфта, стадия, состояние сохранения — как на борде UNDERBEER.
          Имя нужно именно здесь: в архиве сессии иначе различаются только номером. */}
      {sessionId !== undefined && (
        <Toolbar>
          <ToolbarSearch>
            <FormInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => saveTitle(title)}
              placeholder={`Драфт #${sessionId}`}
              aria-label="Название драфта"
            />
          </ToolbarSearch>
          <StatusPill tone={state ? "warn" : "info"}>{state ? "Идёт драфт" : "Настройка"}</StatusPill>
          <ToolbarCount>
            {saving === "saving" ? "сохраняю…" : saving === "error" ? "ошибка сохранения" : "сохранено"}
          </ToolbarCount>
        </Toolbar>
      )}

      {state ? (
        <FearlessRun state={state} setState={apply} heroById={heroById} onReset={reset} />
      ) : (
        <FearlessSetup teams={teams} heroes={heroes} onStart={apply} />
      )}
    </div>
  );
}
