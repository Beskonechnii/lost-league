import type { LobbyStatus } from "@/lib/lobby-room";

/** Стадия комнаты одной пилюлей. Один словарь на список и на саму комнату: подпись стадии
 *  в двух местах разъехалась бы на первой же правке. */
export const PHASE: Record<LobbyStatus, { label: string; tone: "info" | "warn" | "ok" }> = {
  gather: { label: "собираемся", tone: "info" },
  coin: { label: "монетка", tone: "warn" },
  draft: { label: "идёт драфт", tone: "warn" },
  done: { label: "встреча сыграна", tone: "ok" },
};
