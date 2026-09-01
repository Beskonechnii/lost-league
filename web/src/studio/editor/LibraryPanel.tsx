"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeftIcon, XIcon } from "lucide-react";
import { Label } from "@/app/_components/form";
import { Button, IconButton } from "@/components/pouf/Button";
import { FormInput } from "@/components/pouf/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/pouf/select";

// Левая панель: добавление текста и выбор картинки из библиотеки.
// Два источника: «Загруженные материалы» (модель MediaAsset, можно удалять) и «Команды и игроки» —
// команду ищем по имени, открываем её материалы (лого + фото игроков), оттуда кладём нужное на холст.
// Сетки со скроллом фиксированной высоты — панель не растит страницу.

type Media = { id: number; name: string; url: string; width: number | null; height: number | null };
export type LibItem = { src: string; name: string };
export type TeamGroup = { id: number; name: string; logo: string | null; players: LibItem[] };

type Source = "materials" | "teams";

export function LibraryPanel({
  onAdd,
  onAddImage,
  onSetBackground,
  teams,
}: {
  onAdd: (type: "text") => void;
  onAddImage: (src: string, w: number | null, h: number | null) => void;
  /** Поставить картинку фоном холста (режим «В фон»). */
  onSetBackground: (src: string) => void;
  teams: TeamGroup[];
}) {
  const [source, setSource] = useState<Source>("materials");
  // Куда кладёт клик по картинке: новым элементом на холст или фоном под всё.
  const [target, setTarget] = useState<"canvas" | "background">("canvas");

  // Единый обработчик выбора: в режиме фона размеры не нужны — картинка растягивается по холсту.
  const pick: PickFn = target === "background" ? (src) => onSetBackground(src) : onAddImage;

  return (
    <div className="space-y-5">
      <div>
        <Label>Добавить</Label>
        <Button type="button" variant="quiet" size="sm" block className="mt-1" onClick={() => onAdd("text")}>
          + Текст
        </Button>
      </div>

      <div>
        <Label>Библиотека</Label>
        {/* Режим клика по картинке — на холст отдельным слоем или в фон под всё */}
        <div className="mt-1 flex overflow-hidden rounded border border-hairline text-xs">
          {(["canvas", "background"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTarget(t)}
              className={`flex-1 px-2 py-1.5 transition ${
                target === t ? "bg-accent text-white" : "bg-surface-1 text-ink-muted hover:text-ink"
              }`}
            >
              {t === "canvas" ? "На холст" : "В фон"}
            </button>
          ))}
        </div>

        <Select value={source} onValueChange={(v) => setSource(v as Source)}>
          <SelectTrigger className="mt-2 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="materials">Загруженные материалы</SelectItem>
            <SelectItem value="teams">Команды и игроки</SelectItem>
          </SelectContent>
        </Select>

        {source === "materials" ? <Materials onPick={pick} /> : <TeamBrowser teams={teams} onPick={pick} />}
      </div>
    </div>
  );
}

/** Источник «Команды и игроки»: поиск команды → её лого и игроки. */
function TeamBrowser({ teams, onPick }: { teams: TeamGroup[]; onPick: PickFn }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  const team = teams.find((t) => t.id === openId) ?? null;
  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? teams.filter((t) => t.name.toLowerCase().includes(q)) : teams;
  }, [teams, query]);

  if (team) {
    const tiles: LibItem[] = [...(team.logo ? [{ src: team.logo, name: `${team.name} — лого` }] : []), ...team.players];
    return (
      <div className="mt-2">
        <Button type="button" variant="quiet" size="sm" className="mb-2 -ml-1" onClick={() => setOpenId(null)}>
          <ChevronLeftIcon />
          {team.name}
        </Button>
        <TileGrid items={tiles} onPick={onPick} empty="У команды нет лого и фото игроков." />
      </div>
    );
  }

  return (
    <div className="mt-2">
      <FormInput placeholder="Поиск команды…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="scroll-dark mt-2 max-h-72 space-y-1 overflow-y-auto pr-1">
        {found.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setOpenId(t.id)}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-ink-muted transition hover:bg-surface-2 hover:text-ink"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded bg-surface-1">
              {t.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.logo} alt="" className="h-full w-full object-contain" />
              ) : null}
            </span>
            <span className="min-w-0 flex-1 truncate">{t.name}</span>
            <span className="shrink-0 text-xs text-ink-subtle">{t.players.length}</span>
          </button>
        ))}
        {found.length === 0 && <p className="px-2 text-xs text-ink-subtle">Команда не найдена.</p>}
      </div>
    </div>
  );
}

/** Источник «Загруженные материалы»: загрузка, удаление, добавление на холст. */
function Materials({ onPick }: { onPick: PickFn }) {
  const [media, setMedia] = useState<Media[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch("/api/studio/media");
      if (alive && res.ok) setMedia(((await res.json()) as { items: Media[] }).items);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.set("file", file);
    const dims = await readDimensions(file);
    if (dims) {
      body.set("width", String(dims.w));
      body.set("height", String(dims.h));
    }
    const res = await fetch("/api/studio/media", { method: "POST", body });
    const json = (await res.json()) as { item?: Media; error?: string };
    setBusy(false);
    if (!res.ok || !json.item) setError(json.error ?? "Не удалось загрузить");
    else setMedia((m) => [json.item as Media, ...m]);
  }

  async function remove(id: number) {
    setMedia((m) => m.filter((x) => x.id !== id)); // оптимистично
    await fetch(`/api/studio/media/${id}`, { method: "DELETE" });
  }

  return (
    <div className="mt-2">
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="block w-full text-xs text-ink-muted file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-ink"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
      {busy && <p className="mt-1 text-xs text-accent-bright">Загружаю…</p>}
      {error && <p className="mt-1 text-xs text-rose-700">{error}</p>}

      <div className="scroll-dark mt-3 max-h-72 overflow-y-auto pr-1">
        <div className="grid grid-cols-3 gap-2">
          {media.map((m) => (
            <div key={m.id} className="group relative">
              <button
                type="button"
                title={m.name}
                onClick={() => void pickSrc(m.url, onPick)}
                className="grid aspect-square w-full place-items-center overflow-hidden rounded border border-hairline bg-surface-1 transition hover:border-accent/50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.name} className="h-full w-full object-contain" />
              </button>
              <IconButton
                type="button"
                size="xs"
                tone="down"
                label="Удалить из библиотеки"
                onClick={() => void remove(m.id)}
                className="absolute right-0.5 top-0.5 hidden group-hover:inline-flex"
                icon={<XIcon />}
              />
            </div>
          ))}
        </div>
        {media.length === 0 && <p className="text-xs text-ink-subtle">Пусто. Загрузите надписи, фоны, декор.</p>}
      </div>
    </div>
  );
}

/** Сетка плиток-картинок (лого/игроки). */
function TileGrid({ items, onPick, empty }: { items: LibItem[]; onPick: PickFn; empty: string }) {
  return (
    <div className="scroll-dark max-h-72 overflow-y-auto pr-1">
      <div className="grid grid-cols-3 gap-2">
        {items.map((it, i) => (
          <button
            key={`${it.src}-${i}`}
            type="button"
            title={it.name}
            onClick={() => void pickSrc(it.src, onPick)}
            className="grid aspect-square place-items-center overflow-hidden rounded border border-hairline bg-surface-1 transition hover:border-accent/50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.src} alt={it.name} className="h-full w-full object-contain" />
          </button>
        ))}
      </div>
      {items.length === 0 && <p className="text-xs text-ink-subtle">{empty}</p>}
    </div>
  );
}

type PickFn = (src: string, w: number | null, h: number | null) => void;

/** Размеры картинки читаем перед добавлением — пропорции сохранятся у любого источника. */
async function pickSrc(src: string, onPick: PickFn) {
  const dims = await loadSize(src);
  onPick(src, dims?.w ?? null, dims?.h ?? null);
}

function readDimensions(file: File): Promise<{ w: number; h: number } | null> {
  const url = URL.createObjectURL(file);
  return loadSize(url).finally(() => URL.revokeObjectURL(url));
}

function loadSize(src: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
