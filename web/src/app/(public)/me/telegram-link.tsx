"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClasses } from "@/components/pouf/Button";
import { Alert } from "@/components/pouf/feedback";

// Кнопка «Привязать телеграм» (Э19) — общая у настроек и у анкеты.
//
// Привязка случается НЕ в этой вкладке: человек уходит в бота, там жмёт Start, и `tgId` проставляет
// уже бот, в другом процессе. Странице об этом узнать неоткуда — своего пуша с сервера у нас нет,
// — поэтому после ухода она сама спрашивает `/api/tg/link/status` раз в три секунды и обновляет
// серверные данные, как только привязка появилась. Опрос кончается сам: через `WAIT_MS` человек,
// скорее всего, просто закрыл бота, и стучать вечно незачем.

/** Сколько ждём подтверждения из бота, прежде чем предложить попробовать снова. */
const WAIT_MS = 3 * 60_000;
const POLL_MS = 3000;

export function TelegramLink({
  linked,
  username,
  back,
  beforeOpen,
  okText,
}: {
  /** Привязан ли телеграм к аккаунту — по `UserAccount.tgId`. */
  linked: boolean;
  /** Хендл без «@», если Telegram его назвал. У человека без хендла пусто — это нормально. */
  username: string | null;
  /** Куда вернуть, если бот не настроен: путь этой страницы. */
  back: string;
  /** Что успеть сделать до ухода (анкета кладёт черновик). Не ждём: уход открывает соседнюю вкладку. */
  beforeOpen?: () => void;
  /** Чем сказать «уже привязано». У анкеты речь про подтверждённый хендл, у настроек — про канал. */
  okText?: string;
}) {
  const router = useRouter();
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (!waiting) return;
    const started = Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - started > WAIT_MS) {
        setWaiting(false);
        return;
      }
      try {
        const res = await fetch("/api/tg/link/status", { cache: "no-store" });
        if (!res.ok) return; // сессия истекла — молчим: об этом скажет сама страница при обновлении
        const data = (await res.json()) as { linked: boolean };
        if (data.linked) {
          setWaiting(false);
          router.refresh(); // подтянуть хендл и статус с сервера, не перезагружая страницу
        }
      } catch {
        // сеть моргнула — следующий тик спросит снова
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, router]);

  if (linked) {
    return (
      <Alert tone="ok" block>
        {okText ?? `${username ? `Телеграм привязан: @${username}.` : "Телеграм привязан."} Лига пишет вам в этот чат.`}
      </Alert>
    );
  }

  return (
    <div className="space-y-2">
      {/* Ссылка, а не кнопка с window.open: переход в новую вкладку делает браузер сам по клику —
          его не съедает блокировщик всплывашек, и он переживает медленный сервер. */}
      <a
        href={`/api/tg/link/start?back=${encodeURIComponent(back)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          beforeOpen?.();
          setWaiting(true);
        }}
        className={buttonClasses({ size: "lg", block: true })}
      >
        Привязать телеграм
      </a>
      <p className="text-[13px] font-bold leading-[1.45] text-muted">
        {waiting
          ? "Ждём: нажмите в боте «Начать» (Start). Как только он ответит, эта страница обновится сама."
          : "Откроется наш бот — нажмите в нём «Начать». Хендл вводить не нужно: телеграм назовёт вас сам."}
      </p>
    </div>
  );
}
