"use client";

import { useActionState, useMemo, useState } from "react";
import { createProfile, claim } from "./actions";
import { Button } from "@/components/pouf/Button";
import { Alert } from "@/components/pouf/feedback";
import { FormInput, Label } from "@/components/pouf/Input";
import { RowCard } from "@/components/pouf/surface";

// Онбординг УЖЕ ОДОБРЕННОГО аккаунта, у которого почему-то нет профиля: «новый игрок» заводит
// Player сразу, «уже в ростере» подаёт заявку на привязку. Путь новичка (draft → анкета → модерация)
// живёт отдельно, в application-form.tsx: там Player до апрува не создаётся вовсе.
//
// Поиск себя в ростере нужен обоим экранам, поэтому вынесен сюда как PlayerPicker.

export type LinkablePlayer = { id: number; nickname: string; slug: string };

export function Onboarding({ players }: { players: LinkablePlayer[] }) {
  const [mode, setMode] = useState<"pick" | "new" | "existing">("pick");

  if (mode === "pick") {
    return (
      <div className="space-y-3">
        <p className="text-[15px] font-black text-ink">Вы впервые здесь. Кто вы?</p>
        <div className="grid gap-2">
          <RowCard onClick={() => setMode("existing")}>
            <span className="block text-[15px] font-black text-ink">Я уже в ростере</span>
            <span className="mt-0.5 block text-[13px] font-bold leading-[1.45] text-muted">
              Найти себя и привязать профиль (подтвердит организатор).
            </span>
          </RowCard>
          <RowCard onClick={() => setMode("new")}>
            <span className="block text-[15px] font-black text-ink">Я новый игрок</span>
            <span className="mt-0.5 block text-[13px] font-bold leading-[1.45] text-muted">
              Завести личный профиль в лиге.
            </span>
          </RowCard>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button onClick={() => setMode("pick")} className="text-[13px] font-black text-muted transition-colors hover:text-ink">
        ← назад
      </button>
      {mode === "new" ? <NewProfileForm /> : <ClaimForm players={players} />}
    </div>
  );
}

function NewProfileForm() {
  const [error, action, pending] = useActionState(createProfile, null);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label>Ник в лиге</Label>
        <FormInput name="nickname" autoFocus placeholder="Например, Miracle-" />
      </div>
      <Button type="submit" loading={pending} size="lg" block>
        {pending ? "Создаю…" : "Создать профиль"}
      </Button>
      {error && <Alert tone="err" block>{error}</Alert>}
    </form>
  );
}

function ClaimForm({ players }: { players: LinkablePlayer[] }) {
  const [error, action, pending] = useActionState(claim, null);
  const [picked, setPicked] = useState<LinkablePlayer | null>(null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="playerId" value={picked?.id ?? ""} />
      <PlayerPicker players={players} picked={picked} onPick={setPicked} />
      <Button type="submit" disabled={!picked} loading={pending} size="lg" block>
        {pending ? "Отправляю…" : "Подать заявку на привязку"}
      </Button>
      {error && <Alert tone="err" block>{error}</Alert>}
    </form>
  );
}

/** Поиск себя в ростере: подсказка по нику, выбранный игрок отдаётся наружу (id кладут в hidden-поле).
 *  Общий для онбординга и для заявки на привязку из анкеты — списки и тексты должны совпадать. */
export function PlayerPicker({
  players,
  picked,
  onPick,
}: {
  players: LinkablePlayer[];
  picked: LinkablePlayer | null;
  onPick: (player: LinkablePlayer | null) => void;
}) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return players.filter((p) => p.nickname.toLowerCase().includes(q)).slice(0, 8);
  }, [players, query]);

  return (
    <div className="space-y-2">
      <Label>Ваш ник в ростере</Label>
      <FormInput
        autoFocus
        placeholder="Начните вводить ник"
        value={picked ? picked.nickname : query}
        onChange={(e) => {
          onPick(null);
          setQuery(e.target.value);
        }}
      />
      {!picked && matches.length > 0 && (
        // Подсказка — список подушек Кита, а не серый бордер-блок: строка, на которую можно нажать,
        // в этой системе всегда подушка.
        <ul className="space-y-1.5">
          {matches.map((p) => (
            <li key={p.id}>
              <RowCard
                onClick={() => {
                  onPick(p);
                  setQuery("");
                }}
              >
                <span className="text-sm font-black text-ink">{p.nickname}</span>
              </RowCard>
            </li>
          ))}
        </ul>
      )}
      {!picked && query.trim() && matches.length === 0 && (
        <p className="text-[13px] font-bold leading-[1.45] text-muted">
          Никого не нашли. Возможно, вас ещё нет в ростере — тогда заполните анкету нового игрока.
        </p>
      )}
    </div>
  );
}
