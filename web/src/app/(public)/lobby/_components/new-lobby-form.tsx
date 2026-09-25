"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/pouf/Button";
import { Field, FormInput, FormSelect } from "@/components/pouf/Input";
import { Alert } from "@/components/pouf/feedback";
import { Card } from "@/components/pouf/surface";
import { PillButton, PillTrack } from "@/components/pouf/tabs";
import { Eyebrow } from "@/components/pouf/text";

/**
 * Сбор комнаты (ТЗ 42б): название, пароль, имена двух сторон и тайминги.
 *
 * Составов здесь нет намеренно. До 42б стороны были командами ростера, а приглашённые — галочками
 * в их составах: чтобы завести комнату, организатор должен был заранее знать, кто придёт. Теперь
 * имена сторон — свободный текст (встречу играют и те, кого в ростере нет), а люди заходят сами
 * по паролю или по приглашению уже ИЗ комнаты.
 *
 * Пароль хранится открытым и его видно в комнате: это код доступа на вечер, который организатор
 * диктует голосом, а не секрет аккаунта. Генерации нет — задаёт сам.
 *
 * Тайминги — поля, а не константы: к команде могут применяться пенальти (решение 5).
 */

const BEST_OF = [1, 2, 3, 5];

export function NewLobbyForm({
  series,
  defaults,
}: {
  series: { id: number; label: string }[];
  defaults: { mainSec: number; reserveSec: number };
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [password, setPassword] = useState("");
  const [sideAName, setSideAName] = useState("");
  const [sideBName, setSideBName] = useState("");
  const [bestOf, setBestOf] = useState(3);
  const [mainSec, setMainSec] = useState(String(defaults.mainSec));
  const [reserveSec, setReserveSec] = useState(String(defaults.reserveSec));
  const [seriesId, setSeriesId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = !!title.trim() && !!password.trim() && !!sideAName.trim() && !!sideBName.trim();

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/lobby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          password: password.trim(),
          sideAName: sideAName.trim(),
          sideBName: sideBName.trim(),
          mainSec: Number(mainSec),
          reserveSec: Number(reserveSec),
          bestOf,
          seriesId: seriesId ? Number(seriesId) : null,
        }),
      });
      const data = (await res.json()) as { id?: number; error?: string };
      if (!res.ok || !data.id) {
        setError(data.error ?? "Не получилось собрать лобби");
        return;
      }
      router.push(`/lobby/${data.id}`);
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Card variant="tight">
        <div className="space-y-4">
          <Field label="Название встречи" hint="Его увидят все, кто зайдёт в комнату.">
            {(id) => (
              <FormInput
                id={id}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="D1 · SPIRIT vs CTRL"
              />
            )}
          </Field>

          <Field label="Пароль комнаты" hint="Его диктуют игрокам. Виден вам в комнате и меняется в любой момент.">
            {(id) => (
              <FormInput id={id} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="слово на вечер" />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Сторона A" hint="Свободный текст: команда, состав, что угодно.">
              {(id) => (
                <FormInput id={id} value={sideAName} onChange={(e) => setSideAName(e.target.value)} placeholder="SPIRIT" />
              )}
            </Field>
            <Field label="Сторона B">
              {(id) => (
                <FormInput id={id} value={sideBName} onChange={(e) => setSideBName(e.target.value)} placeholder="CTRL" />
              )}
            </Field>
          </div>

          <div>
            <Eyebrow className="mb-1.5">Формат серии</Eyebrow>
            <div className="max-w-[18rem]">
              <PillTrack label="Формат серии">
                {BEST_OF.map((n) => (
                  <PillButton key={n} active={bestOf === n} variant="quiet" onClick={() => setBestOf(n)}>
                    Bo{n}
                  </PillButton>
                ))}
              </PillTrack>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Время хода, сек" hint="Основное время на один бан или пик.">
              {(id) => (
                <FormInput id={id} type="number" min={5} max={600} value={mainSec} onChange={(e) => setMainSec(e.target.value)} />
              )}
            </Field>
            <Field label="Банк, сек" hint="Доп-время команды на весь драфт.">
              {(id) => (
                <FormInput
                  id={id}
                  type="number"
                  min={0}
                  max={3600}
                  value={reserveSec}
                  onChange={(e) => setReserveSec(e.target.value)}
                />
              )}
            </Field>
          </div>

          <Field label="Встреча турнира" hint="Необязательно: лобби собирается и без турнира.">
            {(id) => (
              <FormSelect id={id} size="sm" value={seriesId} onChange={(e) => setSeriesId(e.target.value)}>
                <option value="">Без привязки</option>
                {series.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </FormSelect>
            )}
          </Field>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button tone="orange" disabled={!ready} loading={busy} onClick={submit}>
          Собрать лобби
        </Button>
        {!ready && <Alert tone="warn">Название, пароль и имена обеих сторон.</Alert>}
        {error && <Alert tone="err">{error}</Alert>}
      </div>
    </div>
  );
}
