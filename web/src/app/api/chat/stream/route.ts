import { currentChatMe } from "@/lib/chat";
import { connect, type LiveEvent } from "@/lib/presence";
import { bad } from "@/lib/api";

// Живой канал: одно SSE-соединение на вкладку. Оно же — присутствие (пока поток открыт, человек
// в сети), оно же — доставка новых сообщений. Второго канала и никакого опроса нет: опрос в чате
// это либо задержка в секунды, либо запрос каждую секунду от каждой вкладки.
//
// Почему SSE, а не WebSocket: сервер только вещает, клиент отвечает обычными POST'ами — это ровно
// то, для чего SSE и сделан. Он переживает прокси (DEPLOY.md: Caddy), сам переподключается при
// разрыве и не требует отдельного сервера рядом с Next.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const me = await currentChatMe();
  if (!me) return bad("Живой канал — для игроков лиги", 401);

  const encoder = new TextEncoder();
  let close = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: LiveEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Клиент уже отвалился, а abort ещё не пришёл — писать некуда, и это не ошибка.
        }
      };

      const disconnect = connect({ accountId: me.accountId, playerId: me.playerId, send });

      // Пинг раз в 25 секунд: молчащее соединение прокси и мобильные сети рвут по таймауту,
      // и тогда человек «пропадает» из онлайна, не уходя со страницы.
      const ping = setInterval(() => send({ type: "ping" }), 25_000);

      close = () => {
        clearInterval(ping);
        disconnect();
        try {
          controller.close();
        } catch {
          // Уже закрыт — ничего страшного.
        }
      };
      req.signal.addEventListener("abort", close);
    },
    cancel() {
      close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // прокси не должен копить поток в буфере — иначе живого канала нет
    },
  });
}
