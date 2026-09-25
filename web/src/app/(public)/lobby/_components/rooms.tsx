"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/pouf/Button";
import { FormInput } from "@/components/pouf/Input";
import { Alert, StatusPill } from "@/components/pouf/feedback";
import type { LobbyStatus } from "@/lib/lobby-room";
import { PHASE } from "./phase";

/**
 * Список открытых комнат — он же дверь (ТЗ 42б). Пароль спрашивается ЗДЕСЬ, а не на отдельной
 * странице комнаты: страница закрытой комнаты постороннему отвечает 404, и показать на ней форму
 * входа значило бы сознаться, что комната есть.
 *
 * Тот, кто уже внутри, пароля не вводит: доступ держит членство (`LobbyMember`), и смена пароля
 * его не выбрасывает.
 */

export type RoomRow = {
  id: number;
  title: string;
  status: LobbyStatus;
  sides: string;
  people: number;
  mine: boolean;
};

export function Rooms({ rows }: { rows: RoomRow[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enter(id: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/lobby/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "enter", password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Не получилось войти");
        return;
      }
      router.push(`/lobby/${id}`);
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="rounded-card bg-surface px-4 py-3 cushion-row">
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black text-ink">{r.title}</span>
              <span className="block truncate text-[11px] font-bold text-muted">
                {r.sides} · в комнате: {r.people}
              </span>
            </span>
            <StatusPill tone={PHASE[r.status].tone}>{PHASE[r.status].label}</StatusPill>
            <Button
              size="sm"
              variant={r.mine ? "solid" : "quiet"}
              onClick={() => {
                if (r.mine) {
                  router.push(`/lobby/${r.id}`);
                  return;
                }
                setError(null);
                setPassword("");
                setOpenId(openId === r.id ? null : r.id);
              }}
            >
              {r.mine ? "Открыть" : "Войти"}
            </Button>
          </div>

          {openId === r.id && !r.mine && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
              {/* Ширину держит обёртка: у `FormInput` `w-full` вшит в Кит, и класс по месту его
                  не перебивает — порядок решает не запись, а очередь правил в стилях. */}
              <div className="w-[12rem]">
                <FormInput
                  size="sm"
                  autoFocus
                  type="password"
                  value={password}
                  placeholder="Пароль комнаты"
                  aria-label="Пароль комнаты"
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && password.trim()) void enter(r.id);
                  }}
                />
              </div>
              <Button
                size="sm"
                tone="orange"
                disabled={!password.trim()}
                loading={busy}
                onClick={() => void enter(r.id)}
              >
                Войти
              </Button>
              {error && <Alert tone="err">{error}</Alert>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
