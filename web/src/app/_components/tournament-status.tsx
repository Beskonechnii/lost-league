import { StatusPill } from "@/components/pouf/feedback";
import { TOURNAMENT_STATUS_LABELS, type TournamentStatus } from "@/lib/tournaments";

// Статус турнира плашкой. Один перевод «состояние → тон» на весь продукт: до Э8 он был скопирован
// в четырёх местах (список турниров, обзор турнира и два экрана админки), и в двух из них ещё
// сырыми оттенками Tailwind (`bg-sky-500/20 text-sky-700`) мимо токенов Кита.
//
// Тона: приём заявок — info (действие возможно прямо сейчас), идёт — ok (живое),
// завершён — warn (итог подведён, но турнир уже история), черновик — нейтральный.
const TONE: Record<TournamentStatus, "ok" | "warn" | "info" | "neutral"> = {
  draft: "neutral",
  registration: "info",
  running: "ok",
  finished: "warn",
};

export function TournamentStatus({ status }: { status: string }) {
  const key = (status in TOURNAMENT_STATUS_LABELS ? status : "draft") as TournamentStatus;
  return <StatusPill tone={TONE[key]}>{TOURNAMENT_STATUS_LABELS[key] ?? status}</StatusPill>;
}
