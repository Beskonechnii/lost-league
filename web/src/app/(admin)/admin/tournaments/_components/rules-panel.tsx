"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Toggle } from "@/components/pouf/toggle";
import { Alert } from "@/components/pouf/feedback";
import { Panel } from "../../../_components/panel";

/**
 * Тумблеры правил турнира: «Украсть» и «Закрепить», вкл/выкл — ровно два, чисел (сколько краж
 * на команду) в этом этапе нет (BACKLOG «Настройки правил Mix Cup числом»). Панель одна на оба
 * индивидуальных формата (ТЗ 37): у UNDERBEER-турнира эти тумблеры впервые появляются в UI.
 *
 * До старта драфта активны и пишут в настройки турнира (а если живая сессия уже есть в
 * roster/config — сервер синхронно правит и её DraftState, см. `PATCH /api/tournaments/[id]`).
 * С фазы draft — `disabled` с подсказкой, а не спрятаны: оператор должен видеть, что включено.
 */
export function RulesPanel({
  tournamentId,
  stealEnabled: initialSteal,
  lockEnabled: initialLock,
  locked,
}: {
  tournamentId: number;
  stealEnabled: boolean;
  lockEnabled: boolean;
  locked: boolean;
}) {
  const [stealEnabled, setSteal] = useState(initialSteal);
  const [lockEnabled, setLock] = useState(initialLock);
  const [busy, setBusy] = useState(false);

  async function patch(patch: { stealEnabled?: boolean; lockEnabled?: boolean }) {
    setBusy(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      toast.error(`Не удалось сохранить правило: ${e instanceof Error ? e.message : e}`);
      // откат оптимистичного переключения
      if (patch.stealEnabled !== undefined) setSteal((v) => !v);
      if (patch.lockEnabled !== undefined) setLock((v) => !v);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Правила" hint="Тумблеры действуют только для этого турнира — ad hoc-драфты UNDERBEER не трогают.">
      <div className="flex flex-wrap items-center gap-6">
        <Toggle
          label="Украсть"
          checked={stealEnabled}
          disabled={locked || busy}
          title={locked ? "Правила зафиксированы на старте драфта" : undefined}
          onCheckedChange={(v) => {
            setSteal(v);
            void patch({ stealEnabled: v });
          }}
        />
        <Toggle
          label="Закрепить"
          checked={lockEnabled}
          disabled={locked || busy}
          title={locked ? "Правила зафиксированы на старте драфта" : undefined}
          onCheckedChange={(v) => {
            setLock(v);
            void patch({ lockEnabled: v });
          }}
        />
      </div>
      <div className="mt-4">
        <Alert tone="info" block>
          Выключенное действие пропадёт с борда — не будет кнопки, только обычный пик.
        </Alert>
      </div>
    </Panel>
  );
}
