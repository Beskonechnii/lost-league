"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { consumeMixCupIntent } from "./actions";

/**
 * Тихий эффект «а не шёл ли человек сюда ради записи на турнир» (ТЗ 34/37). На /join/<slug> гость
 * нажимает «Участвовать» → кука-намерение → сюда, на /me, на вход/анкету. Как только профиля
 * хватает для записи (анкета отправлена либо аккаунт уже одобрен), сервер отдаёт путь назад на
 * турнир — здесь остаётся только уйти по нему. Не хватает — action возвращает null, эффект
 * молчит, страница ведёт себя как обычный /me.
 *
 * Записывает не он, а сама страница записи (ТЗ 38): роли спрашиваются там, и запись без них
 * была бы ровно той дырой, которую 38 закрывает.
 *
 * `retryKey` меняется ровно в момент, когда решение могло стать другим (анкета отправлена) — эффект
 * перезапускается и проверяет снова. Без вечного опроса: та же кука, тот же аккаунт, лишний фетч
 * не страшен (действие идемпотентно), но и незачем гонять его на каждый чих.
 */
export function MixCupIntentConsumer({ retryKey }: { retryKey: string }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void consumeMixCupIntent().then((path) => {
      if (!cancelled && path) router.replace(path);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- retryKey нарочно единственный триггер
  }, [retryKey]);

  return null;
}
