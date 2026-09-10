"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/pouf/Button";
import { Checkbox } from "@/components/pouf/checkbox";
import { Meter } from "@/components/pouf/blocks";
import { Alert } from "@/components/pouf/feedback";
import { RankMedal, RankTrend } from "@/components/pouf/rank";
import { rankLabel } from "@/lib/dota-rank";
import type { RankResult } from "@/lib/rank-refresh";
import { planRankRefresh, runRankChunk } from "./actions";

/* Кнопка массового обновления рангов и её прогресс.
 *
 * Прогон идёт горстями (см. `actions.ts`), и цикл живёт ЗДЕСЬ, на клиенте: сервер не умеет
 * рассказывать странице, как идут дела, а трёхминутная операция без обратной связи неотличима от
 * зависшей — оператор перезагружает страницу и запускает всё заново.
 *
 * Прогон можно остановить: флаг в ref проверяется между горстями. Уже записанное остаётся —
 * каждая горсть закоммичена до того, как запрошена следующая.
 */

type Phase = "idle" | "running" | "done" | "stopped" | "error";

export function RefreshPanel({ withoutId }: { withoutId: number }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [all, setAll] = useState(false);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [log, setLog] = useState<RankResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);

  async function start() {
    stop.current = false;
    setPhase("running");
    setError(null);
    setLog([]);
    setDone(0);
    setTotal(0);
    try {
      const plan = await planRankRefresh(!all);
      setTotal(plan.targets.length);
      if (plan.targets.length === 0) {
        setPhase("done");
        return;
      }
      for (let i = 0; i < plan.targets.length; i += plan.chunk) {
        if (stop.current) {
          setPhase("stopped");
          router.refresh();
          return;
        }
        const results = await runRankChunk(plan.targets.slice(i, i + plan.chunk));
        // В журнал кладём только то, что изменилось: строка «без изменений» на каждого из двухсот
        // игроков — не отчёт, а стена, в которой настоящие смены не найти.
        setLog((prev) => [...results.filter((r) => r.outcome !== "same"), ...prev]);
        setDone((n) => n + results.length);
      }
      setPhase("done");
      router.refresh(); // таблица под панелью — серверная, ей нужен новый рендер
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось обновить ранги");
      setPhase("error");
      router.refresh();
    }
  }

  const running = phase === "running";
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-4 font-pouf">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={start} loading={running} disabled={running}>
          {running ? "Обновляем…" : "Обновить ранги"}
        </Button>
        {running && (
          <Button variant="quiet" onClick={() => (stop.current = true)}>
            Остановить
          </Button>
        )}
        <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-muted">
          <Checkbox checked={all} disabled={running} onCheckedChange={(v) => setAll(v === true)} />
          Все, даже сверенные за последние сутки
        </label>
      </div>

      {total > 0 && (
        <div className="max-w-md space-y-1">
          <Meter pct={pct} />
          <div className="text-xs font-extrabold tabular-nums text-muted">
            {done} из {total}
            {running && " · примерно секунда на игрока — это ограничение OpenDota, а не наша медлительность"}
          </div>
        </div>
      )}

      {phase === "done" && total === 0 && (
        <Alert tone="ok" block>
          Обновлять нечего: у всех, у кого есть account_id, ранг сверен меньше суток назад. Нужен
          прогон прямо сейчас — поставьте галочку «Все».
        </Alert>
      )}
      {phase === "stopped" && <Alert tone="warn" block>Прогон остановлен. Всё, что успели, уже записано.</Alert>}
      {phase === "error" && error && <Alert tone="err" block>{error}</Alert>}
      {withoutId > 0 && (
        <Alert tone="info" block>
          {withoutId} игроков без account_id — их ранг взять неоткуда. Добить id можно импортом CRM
          или руками в карточке игрока.
        </Alert>
      )}

      {log.length > 0 && (
        <div className="space-y-1.5">
          {log.map((r) => (
            <div key={`${r.id}-${r.outcome}-${r.rank}`} className="flex flex-wrap items-center gap-2 text-sm font-bold">
              <RankMedal tier={r.rank} size="sm" />
              <span className="font-black text-ink">{r.nickname}</span>
              {r.outcome === "unknown" ? (
                <span className="text-muted">профиль не ответил — оставили как было</span>
              ) : r.outcome === "first" ? (
                <span className="text-muted">ранг появился впервые: {rankLabel(r.rank)}</span>
              ) : (
                <>
                  <span className="text-muted">
                    {rankLabel(r.prev)} → {rankLabel(r.rank)}
                  </span>
                  <RankTrend tier={r.rank} prev={r.prev} />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
