"use client";

import { useCallback, useEffect, useState } from "react";
// Только типы: import type стирается при компиляции, серверный fs сюда не утекает.
import type { ArchiveEntry, ArchiveMeta, ShotKind } from "@/lib/postgame-archive";

// Архив разобранных матчей — полка готовых картинок из public/uploads/postgame.
// Храним то, что реально ушло в работу (выгруженные PNG), а не повод собрать их заново:
// подробности почему — в lib/postgame-archive.ts.

export type { ArchiveEntry, ShotKind };
/** То, что клиент знает о картинке. Время выгрузки проставляет сервер — часы у него одни. */
export type ArchiveDraft = Omit<ArchiveMeta, "savedAt">;

/** Полка с сервера. reload() зовут после выгрузки — иначе свежая картинка не появится. */
export function useArchive() {
  const [items, setItems] = useState<ArchiveEntry[]>([]);

  const reload = useCallback(() => {
    fetch("/api/postgame/archive")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j) => setItems(Array.isArray(j.items) ? j.items : []))
      .catch(() => {}); // архив — удобство, его недоступность не должна ломать разбор матча
  }, []);

  useEffect(() => reload(), [reload]);

  return { items, reload };
}

/** Положить картинку на полку. Бросает с человеческим текстом — его показывает кнопка. */
export async function archiveShot(meta: ArchiveDraft, kind: ShotKind, blob: Blob): Promise<void> {
  const form = new FormData();
  form.set("kind", kind);
  form.set("meta", JSON.stringify(meta));
  form.set("file", blob, `${meta.matchId}-${kind}.png`);

  const res = await fetch("/api/postgame/archive", { method: "POST", body: form });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) throw new Error(json?.error ?? `Не сохранилось (${res.status})`);
}

async function dropEntry(matchId: string): Promise<void> {
  await fetch(`/api/postgame/archive?matchId=${matchId}`, { method: "DELETE" });
}

const KIND_LABEL: Record<ShotKind, string> = { summary: "Сводка", players: "Игроки" };

function Card({ entry, onOpen, onDropped }: { entry: ArchiveEntry; onOpen: () => void; onDropped: () => void }) {
  // Обложка — сводка, если она есть: на ней счёт и команды, узнаётся с одного взгляда.
  const cover = entry.shots.summary ?? entry.shots.players;
  const win = entry.radiantWin ? entry.radiant : entry.dire;
  const date = new Date(entry.savedAt).toLocaleDateString("ru-RU");

  return (
    <div className="group relative w-44 shrink-0 overflow-hidden rounded-control bg-surface font-pouf cushion-field transition-transform hover:-translate-y-0.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cover}
        alt={`${entry.radiant} — ${entry.dire}`}
        title={`#${entry.matchId} · победа: ${win}`}
        className="aspect-video w-full object-cover"
      />
      <div className="p-1.5 text-[11px] leading-tight">
        <div className="flex items-baseline gap-1">
          <span className={`min-w-0 flex-1 truncate ${entry.radiantWin ? "text-ink" : "text-ink-subtle"}`}>
            {entry.radiant}
          </span>
          <span className="shrink-0 tabular-nums text-ink-muted">
            {entry.radiantScore}–{entry.direScore}
          </span>
          <span className={`min-w-0 flex-1 truncate text-right ${entry.radiantWin ? "text-ink-subtle" : "text-ink"}`}>
            {entry.dire}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-ink-subtle">
          <span>{date}</span>
          {/* Источник помечаем только у Steam: OpenDota — путь по умолчанию, метка была бы шумом. */}
          {entry.source === "steam" && <span>STEAM</span>}
          <span className="ml-auto flex gap-1">
            {(Object.keys(entry.shots) as ShotKind[]).map((kind) => (
              <a
                key={kind}
                href={entry.shots[kind]}
                target="_blank"
                rel="noreferrer"
                title={`Открыть PNG: ${KIND_LABEL[kind]}`}
                className="rounded bg-surface-2 px-1 text-ink-muted hover:text-ink"
              >
                {KIND_LABEL[kind]}
              </a>
            ))}
          </span>
        </div>
      </div>

      {/* Действия поверх обложки: разобрать матч заново (id и источник помним) и убрать с полки. */}
      <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={onOpen}
          title={`Разобрать матч #${entry.matchId} заново`}
          className="rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-ink-muted hover:text-white"
        >
          ↻
        </button>
        <button
          onClick={() => void dropEntry(entry.matchId).then(onDropped)}
          title="Убрать из архива (удалит картинки)"
          aria-label={`Убрать матч ${entry.matchId} из архива`}
          className="rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-ink-muted hover:text-rose-700"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function MatchArchive({
  items,
  onOpen,
  onChanged,
}: {
  items: ArchiveEntry[];
  onOpen: (e: ArchiveEntry) => void;
  onChanged: () => void;
}) {
  if (!items.length) return null;

  return (
    <div className="mb-6 font-pouf">
      <div className="mb-1.5 text-[13px] font-extrabold uppercase tracking-[1.5px] text-muted">Архив выгрузок</div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((e) => (
          <Card key={e.matchId} entry={e} onOpen={() => onOpen(e)} onDropped={onChanged} />
        ))}
      </div>
    </div>
  );
}
