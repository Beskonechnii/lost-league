"use client";

import { useEffect } from "react";
import { Button } from "@/components/pouf/Button";
import { StubPage } from "@/app/_components/stub-page";

// Граница ошибок служебной части. Своего экрана у неё нет — тот же `StubPage`, что у корня:
// разговор один и тот же (что случилось, куда идти), а второй вид экрана ошибки разошёлся бы
// с первым. Клиентская и с `reset()`: половина падений здесь — сорванный запрос к базе.

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StubPage
      icon="warn"
      title="Инструмент не открылся"
      action={
        <Button size="sm" onClick={reset}>
          Попробовать снова
        </Button>
      }
    >
      Что-то сломалось на нашей стороне. Повторите попытку — если не помогает, назовите код
      {error.digest ? ` ${error.digest} ` : " "}в чате лиги.
    </StubPage>
  );
}
