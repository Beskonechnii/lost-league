"use client";

import { useMemo, useState } from "react";
import { playerPath } from "@/lib/profiles";
import { useRouter } from "next/navigation";
import Link from "next/link";
// Страница на компонентах Кита («подушки» claymorphism), как архив серий.
import { Button as PoufButton } from "@/components/pouf/Button";
import { Input as PoufInput } from "@/components/pouf/Input";
import { Card } from "@/components/pouf/surface";
import { Sheet } from "@/components/pouf/sheet";
import { Segmented } from "@/components/pouf/Segmented";
import { Heading, Eyebrow, Text } from "@/components/pouf/text";

// Команду не показываем и не храним у TP: зачёт сквозной по сезонам, а составы от сезона к сезону
// меняются — привязка к команде тут только путала бы.
type Row = { id: number; nickname: string; tp: number };

/** Записать игроку tp. Возвращает текст ошибки или null. */
async function saveTp(id: number, tp: number): Promise<string | null> {
  const res = await fetch(`/api/roster/players/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tp }),
  });
  const json = await res.json().catch(() => ({}));
  return res.ok ? null : json.error ?? "Не вышло сохранить";
}

// Строка редактора: ник + поле TP. Кнопка «Сохранить» появляется, только когда значение отличается
// от сохранённого — так видно, что ещё не записано, и нельзя случайно перезаписать нулём.
function TpRow({ row }: { row: Row }) {
  const [value, setValue] = useState(String(row.tp));
  // Сохранённое значение держим локально: строка живёт дольше одного ответа сервера,
  // а props мутировать нельзя.
  const [saved, setSaved] = useState(row.tp);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const num = value.trim() === "" ? 0 : Number(value);
  const valid = Number.isInteger(num) && num >= 0;
  const dirty = num !== saved;

  const save = async () => {
    if (!valid || !dirty) return;
    setBusy(true);
    setError(null);
    const err = await saveTp(row.id, num);
    setBusy(false);
    if (err) return setError(err);
    setSaved(num); // локально сразу гасим «Сохранить»; сервер догонит на refresh
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  };

  return (
    <div className="flex items-center gap-3 py-2">
      <Link href={playerPath(row.id)} target="_blank" className="min-w-0 flex-1 font-bold hover:underline">
        {row.nickname}
      </Link>
      <div className="w-24 shrink-0">
        <PoufInput
          value={value}
          onChange={setValue}
          onKeyDown={(e) => e.key === "Enter" && save()}
          inputMode="numeric"
          label="TP"
        />
      </div>
      <div className="w-28 shrink-0 text-right">
        {dirty && valid ? (
          <PoufButton size="sm" onClick={save} loading={busy}>
            Сохранить
          </PoufButton>
        ) : done ? (
          <Text size="sm" muted>
            ✓ сохранено
          </Text>
        ) : !valid ? (
          <span className="text-[13px] font-bold text-[var(--warn)]">только целое ≥ 0</span>
        ) : null}
      </div>
      {error && <span className="text-[13px] font-bold text-[var(--down)]">{error}</span>}
    </div>
  );
}

/** Окно «Начислить очки»: выбор игрока из списка + поле TP. Минимум полей — ни команд, ни ролей. */
function AwardSheet({ players, open, onOpenChange, onSaved }: {
  players: Row[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Row | null>(null);
  const [value, setValue] = useState(""); // сколько ДОБАВИТЬ, а не итоговое значение
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Список фильтруем по нику; пока никого не выбрали — показываем совпадения, чтобы кликнуть.
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    return players
      .filter((p) => !s || p.nickname.toLowerCase().includes(s))
      .sort((a, b) => a.nickname.localeCompare(b.nickname))
      .slice(0, 40);
  }, [players, q]);

  // add — сколько начисляем; итог = текущее + add. Разрешаем и минус (корректировка), но не в минус по сумме.
  const add = value.trim() === "" || value.trim() === "-" ? 0 : Number(value);
  const result = (picked?.tp ?? 0) + add;
  const valid = Number.isInteger(add) && add !== 0 && result >= 0;

  const pick = (p: Row) => {
    setPicked(p);
    setValue(""); // начисляем сверху текущего, поле начинается с нуля
    setError(null);
  };

  const bump = (n: number) => setValue(String((Number.isInteger(add) ? add : 0) + n));

  const reset = () => {
    setPicked(null);
    setQ("");
    setValue("");
    setError(null);
  };

  const save = async () => {
    if (!picked || !valid) return;
    setBusy(true);
    setError(null);
    const err = await saveTp(picked.id, result); // API пишет итог; прибавляем на клиенте
    setBusy(false);
    if (err) return setError(err);
    reset();
    onOpenChange(false);
    onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }} title="Начислить очки">
      <div className="flex flex-col gap-4">
        {picked ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px] font-black">{picked.nickname}</span>
              <PoufButton variant="quiet" size="sm" onClick={reset}>
                сменить
              </PoufButton>
            </div>
            <Text size="sm" muted>
              Сейчас {picked.tp} TP{valid ? ` → станет ${result}` : ""}
            </Text>
            {/* Быстрые кнопки: прибавляют к начислению, а не сохраняют сразу — можно накликать +5+5 = 10 */}
            <div className="flex gap-2">
              {[1, 5, 10].map((n) => (
                <PoufButton key={n} variant="quiet" size="sm" onClick={() => bump(n)}>
                  +{n}
                </PoufButton>
              ))}
            </div>
            <PoufInput
              value={value}
              onChange={setValue}
              onKeyDown={(e) => e.key === "Enter" && save()}
              inputMode="numeric"
              label="Начислить"
              placeholder="+ очки"
            />
            <PoufButton block onClick={save} disabled={!valid} loading={busy}>
              {valid ? `Начислить ${add > 0 ? "+" : ""}${add}` : "Начислить"}
            </PoufButton>
          </>
        ) : (
          <>
            <PoufInput value={q} onChange={setQ} placeholder="Поиск по нику" label="Игрок" />
            <div className="max-h-72 overflow-y-auto rounded-xl">
              {matches.length === 0 ? (
                <Text size="sm" muted>
                  Никого не нашлось.
                </Text>
              ) : (
                matches.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pick(p)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-[var(--surface-2,rgba(255,255,255,0.06))]"
                  >
                    <span className="font-bold">{p.nickname}</span>
                    {p.tp > 0 && <span className="text-[13px] font-bold text-[var(--accent-ink)]">{p.tp} TP</span>}
                  </button>
                ))
              )}
            </div>
          </>
        )}
        {error && <span className="text-[13px] font-bold text-[var(--down)]">{error}</span>}
      </div>
    </Sheet>
  );
}

export function TpAdmin({ players, title = "TP" }: { players: Row[]; title?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "scored">("scored");
  const [award, setAward] = useState(false);

  // По умолчанию — те, у кого TP уже есть, сверху; дальше по нику. Так свежий зачёт правится в один
  // проход. При «только с TP» показываем лишь набравших (по умолчанию: их и правят чаще всего).
  const rows = players
    .filter((p) => (only === "scored" ? p.tp > 0 : true))
    .filter((p) => !q.trim() || p.nickname.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => b.tp - a.tp || a.nickname.localeCompare(b.nickname));

  const total = players.reduce((s, p) => s + p.tp, 0);
  const scored = players.filter((p) => p.tp > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Служебная часть · зачёт</Eyebrow>
          <Heading level={1}>{title}</Heading>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Text size="sm" muted>
            Идут в{" "}
            <Link href="/tp" className="font-bold text-[var(--accent-ink)] hover:underline">
              публичный зачёт
            </Link>
            . Набрали: {scored} · всего {total} TP
          </Text>
          <PoufButton onClick={() => setAward(true)}>+ Начислить очки</PoufButton>
        </div>
      </div>

      <AwardSheet players={players} open={award} onOpenChange={setAward} onSaved={() => router.refresh()} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-56">
          <PoufInput value={q} onChange={setQ} placeholder="Поиск по нику" label="Поиск по нику" />
        </div>
        <Segmented
          value={only}
          onChange={setOnly}
          label="Показ"
          tone="purple"
          options={[
            { value: "scored", label: `С TP  ${scored}` },
            { value: "all", label: `Все  ${players.length}` },
          ]}
        />
      </div>

      <Card variant="tight">
        {rows.length === 0 ? (
          <Text size="sm" muted>
            Никого не нашлось.
          </Text>
        ) : (
          <div className="divide-y divide-[var(--hairline,rgba(255,255,255,0.08))]">
            {rows.map((r) => (
              <TpRow key={`${r.id}:${r.tp}`} row={r} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
