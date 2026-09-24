"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlayerAvatar } from "@/app/(public)/roster/_components/avatar";
import { PlayerLine } from "@/components/pouf/player-line";
import { Button } from "@/components/pouf/Button";
import { EmptyState } from "@/components/pouf/feedback";
import { Capacity } from "@/components/pouf/capacity";
import { PillButton, PillTrack } from "@/components/pouf/tabs";
import { Panel } from "../../../_components/panel";

export type Registrant = {
  id: number;
  nickname: string;
  photo: string | null;
  /** Не прошёл модерацию (запись до апрува, ТЗ 34) — подпись «новичок, не проверен» и в
   *  этом списке, и в пуле драфта: оператор обязан отличать их с первого взгляда. */
  verified: boolean;
};

/**
 * Список записавшихся (Scope п.5/6 ТЗ 34, общий для обоих форматов с ТЗ 37) — и разрез «пришли
 * с записи» списком (непроверенные подписаны прямо в строке), и фильтром (таб «Новички»), и
 * кнопка «взять участников в драфт», которая заполняет фазу отбора ровно этим списком, а не
 * отмечается вручную по ростеру. Счётчик стоит рядом с кнопкой: «сколько из скольких» оператор
 * должен видеть там же, где нажимает (DESIGN §4 ТЗ 37).
 */
export function ParticipantsPanel({
  tournamentId,
  slug,
  items,
  limit = null,
}: {
  tournamentId: number;
  slug: string;
  items: Registrant[];
  /** Лимит мест — до ТЗ 39 всегда null, счётчик тогда печатает просто число участников. */
  limit?: number | null;
}) {
  const [onlyNew, setOnlyNew] = useState(false);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const newbies = useMemo(() => items.filter((p) => !p.verified), [items]);
  const shown = onlyNew ? newbies : items;

  async function takeToDraft() {
    setBusy(true);
    try {
      const started = await fetch(`/api/tournaments/${tournamentId}/draft`, { method: "POST" });
      if (!started.ok) throw new Error(await started.text());
      const filled = await fetch(`/api/tournaments/${tournamentId}/participants`, { method: "POST" });
      if (!filled.ok) throw new Error(await filled.text());
      router.push(`/admin/tournaments/${slug}/draft`);
    } catch (e) {
      toast.error(`Не удалось собрать участников: ${e instanceof Error ? e.message : e}`);
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Участники"
      hint="Записались на турнир — оператор берёт их в драфт одной кнопкой, а не отмечает руками по ростеру."
      aside={
        <div className="flex flex-wrap items-center gap-3">
          <Capacity taken={items.length} limit={limit} unit="players" size="sm" meter={false} />
          <Button onClick={takeToDraft} loading={busy} tone="orange" disabled={items.length === 0}>
            Взять участников в драфт
          </Button>
        </div>
      }
    >
      {items.length === 0 ? (
        <EmptyState icon="flame" title="Пока никто не записался">
          Ссылка на запись — /join/{slug}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          <PillTrack label="Разрез участников">
            <PillButton size="sm" variant="quiet" active={!onlyNew} onClick={() => setOnlyNew(false)}>
              Все ({items.length})
            </PillButton>
            <PillButton size="sm" variant="quiet" active={onlyNew} onClick={() => setOnlyNew(true)}>
              Новички ({newbies.length})
            </PillButton>
          </PillTrack>
          <div className="divide-y divide-[var(--line)]">
            {shown.map((p) => (
              <PlayerLine
                key={p.id}
                thumb={<PlayerAvatar photo={p.photo} nickname={p.nickname} color={null} size={32} className="!rounded-[12px]" />}
                nickname={p.nickname}
                note={p.verified ? undefined : "новичок, не проверен"}
                hideValue
              />
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
