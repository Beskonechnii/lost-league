import { NextResponse } from "next/server";
import { bad, parseId } from "@/lib/api";
import { applyIntent, currentViewer, mayEnter, readRoom, touchLobby, type Intent } from "@/lib/lobby";
import type { TeamIdx } from "@/lib/fearless";

// Одна комната: снимок целиком (GET) и НАМЕРЕНИЕ участника (PATCH). Готового состояния сервер не
// принимает — в отличие от /api/fearless, где на том конце доверенный оператор.
//
// Посторонний получает 404, а не 403: лобби закрытое (решение 9), и «403» само по себе сообщало бы,
// что комната с таким номером существует.

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");
  const viewer = await currentViewer();
  // Часы досчитываются до чтения: пока вкладки были закрыты, время шло, и снимок обязан показать
  // уже сделанные автоходы, а не «замороженный» ход месячной давности.
  if (viewer) await touchLobby(id);
  const room = await readRoom(id);
  if (!room || !mayEnter(room, viewer)) return bad("Лобби не найдено", 404);
  return NextResponse.json(room);
}

type Body = {
  intent?: string;
  side?: number;
  value?: unknown;
  block?: string;
  heroId?: unknown;
  at?: unknown;
  password?: unknown;
  title?: unknown;
  sideAName?: unknown;
  sideBName?: unknown;
  playerId?: unknown;
};

const str = (raw: unknown): string => (typeof raw === "string" ? raw.trim() : "");

const asSide = (raw: unknown): TeamIdx | null => (raw === 0 || raw === 1 ? (raw as TeamIdx) : null);

/** Тело запроса → намерение. Незнакомое — null, то есть 400, а не молчаливое ничего. */
function toIntent(body: Body): Intent | null {
  switch (body.intent) {
    case "enter": {
      const password = str(body.password);
      return password ? { kind: "enter", password } : null;
    }
    case "settings": {
      const title = str(body.title);
      const password = str(body.password);
      if (!title || !password) return null;
      return { kind: "settings", title, password, sideAName: str(body.sideAName), sideBName: str(body.sideBName) };
    }
    case "invite": {
      const playerId = parseId(body.playerId as number);
      return playerId === null ? null : { kind: "invite", playerId };
    }
    case "join":
      return { kind: "join" };
    case "captain":
      return { kind: "captain" };
    case "resign":
      return { kind: "resign" };
    case "unseat": {
      const side = asSide(body.side);
      return side === null ? null : { kind: "unseat", side };
    }
    case "ready":
      return { kind: "ready", value: body.value !== false };
    case "coin": {
      const value = asSide(body.value);
      if (value === null || (body.block !== "side" && body.block !== "order")) return null;
      return { kind: "coin", block: body.block, value };
    }
    case "pick": {
      // Ход — намерение: сервер получает «хочу этого героя» и номер хода, а состояние драфта
      // считает и пишет сам. Готовый payload здесь не принимается никогда.
      const heroId = parseId(body.heroId as number);
      const at = Number(body.at);
      if (heroId === null || !Number.isInteger(at) || at < 0) return null;
      return { kind: "pick", heroId, at };
    }
    case "next":
      return { kind: "next" };
    default:
      return null;
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");
  const viewer = await currentViewer();
  if (!viewer) return bad("Лобби не найдено", 404);

  const intent = toIntent((await req.json().catch(() => ({}))) as Body);
  if (!intent) return bad("Не разобрал действие");

  const result = await applyIntent(id, viewer, intent);
  if (!result.ok) return bad(result.error, result.error === "Лобби не найдено" ? 404 : 400);
  return NextResponse.json(result.room);
}
