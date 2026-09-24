"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Toggle } from "@/components/pouf/toggle";
import { Alert } from "@/components/pouf/feedback";
import { Button } from "@/components/pouf/Button";
import { FormInput, Label } from "@/components/pouf/Input";
import { Capacity } from "@/components/pouf/capacity";
import { Panel } from "../../../_components/panel";

/**
 * Тумблеры правил турнира: «Украсть» и «Закрепить», вкл/выкл — ровно два, чисел (сколько краж
 * на команду) в этом этапе нет (BACKLOG «Настройки правил Mix Cup числом»). Панель одна на оба
 * индивидуальных формата (ТЗ 37): у UNDERBEER-турнира эти тумблеры впервые появляются в UI.
 * Здесь же поле «Мест на турнире» (ТЗ 39) — условие приёма, а не драфта, но задаётся тем же
 * экраном и тем же PATCH, второй панели ради одного числа не заводим.
 *
 * До старта драфта активны и пишут в настройки турнира (а если живая сессия уже есть в
 * roster/config — сервер синхронно правит и её DraftState, см. `PATCH /api/tournaments/[id]`).
 * С фазы draft — `disabled` с подсказкой, а не спрятаны: оператор должен видеть, что включено.
 */
export function RulesPanel({
  tournamentId,
  stealEnabled: initialSteal,
  lockEnabled: initialLock,
  registrationLimit: initialLimit,
  taken,
  locked,
}: {
  tournamentId: number;
  stealEnabled: boolean;
  lockEnabled: boolean;
  /** Лимит мест (ТЗ 39); null — приём без ограничения. */
  registrationLimit: number | null;
  /** Сколько уже записалось — знаменателя мало, оператор задаёт лимит, глядя на текущее число. */
  taken: number;
  locked: boolean;
}) {
  const router = useRouter();
  const [stealEnabled, setSteal] = useState(initialSteal);
  const [lockEnabled, setLock] = useState(initialLock);
  const [limit, setLimit] = useState(initialLimit == null ? "" : String(initialLimit));
  const [busy, setBusy] = useState(false);

  async function patch(patch: { stealEnabled?: boolean; lockEnabled?: boolean; registrationLimit?: number | null }) {
    setBusy(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      // Причина отказа приезжает полем `error` (src/lib/api.ts) — в тост кладём её, а не весь JSON:
      // «Уже записано 2 — лимит меньше поставить нельзя» оператор должен прочитать, а не разобрать.
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? `Ошибка ${res.status}`);
      // Счётчик мест живёт в соседней панели — после сохранения лимита её надо перечитать.
      if (patch.registrationLimit !== undefined) router.refresh();
    } catch (e) {
      toast.error(`Не удалось сохранить правило: ${e instanceof Error ? e.message : e}`);
      // откат оптимистичного переключения
      if (patch.stealEnabled !== undefined) setSteal((v) => !v);
      if (patch.lockEnabled !== undefined) setLock((v) => !v);
      if (patch.registrationLimit !== undefined) setLimit(initialLimit == null ? "" : String(initialLimit));
    } finally {
      setBusy(false);
    }
  }

  /** Пусто — снять ограничение (null), иначе число. Всё остальное отсеивает сервер. */
  function saveLimit() {
    const raw = limit.trim();
    void patch({ registrationLimit: raw === "" ? null : Number(raw) });
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
      {/* Лимит записи (ТЗ 39) — в той же панели, что тумблеры: это тоже условие турнира, которое
          оператор задаёт до старта. Тумблерами не блокируется: приём и драфт живут порознь. */}
      <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-hairline pt-4">
        <div>
          <Label htmlFor="registration-limit">Мест на турнире</Label>
          <FormInput
            id="registration-limit"
            type="number"
            min={1}
            inputMode="numeric"
            size="sm"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="без ограничения"
            className="mt-1.5 w-40"
          />
        </div>
        <Button size="sm" variant="quiet" onClick={saveLimit} loading={busy}>
          Сохранить
        </Button>
        <div className="pb-1">
          <Capacity taken={taken} limit={initialLimit} unit="players" size="sm" meter={false} />
        </div>
      </div>

      <div className="mt-4">
        <Alert tone="info" block>
          Выключенное действие пропадёт с борда — не будет кнопки, только обычный пик.
        </Alert>
      </div>
    </Panel>
  );
}
