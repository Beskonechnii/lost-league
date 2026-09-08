"use client";

import { useEffect } from "react";
import { Button } from "@/components/pouf/Button";
import { StubPage } from "./_components/stub-page";

// Граница ошибок на весь сайт. Обязана быть клиентской и обязана давать `reset()`: половина
// падений — это сорванный запрос к базе или к Steam, и повтор их чинит без перезагрузки страницы.
// Текст ошибки посетителю не показываем (в нём бывают пути и куски SQL) — только `digest`,
// по которому запись находится в логе сервера.

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StubPage
      icon="warn"
      title="Страница не открылась"
      action={
        <Button size="sm" onClick={reset}>
          Попробовать снова
        </Button>
      }
    >
      Что-то сломалось на нашей стороне. Повторите попытку — если не помогает, напишите нам
      {error.digest ? ` и назовите код ${error.digest}.` : "."}
    </StubPage>
  );
}
