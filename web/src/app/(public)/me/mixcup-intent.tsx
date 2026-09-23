"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { consumeMixCupIntent } from "./actions";

/**
 * Тихий эффект «а не шёл ли человек сюда ради Mix Cup» (ТЗ 34). На /mixcup/<slug> гость нажимает
 * «Участвовать» → кука-намерение → сюда, на /me, на вход/анкету. Как только профиля хватает для
 * записи (анкета отправлена либо аккаунт уже одобрен), сервер тихо записывает и отдаёт путь назад
 * на событие — здесь остаётся только уйти по нему. Не хватает — action возвращает null, эффект
 * молчит, страница ведёт себя как обычный /me.
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
