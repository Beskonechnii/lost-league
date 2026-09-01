"use client";

import { useActionState } from "react";
import { Button } from "@/components/pouf/Button";

// Обёртка формы админки турниров с обратной связью. Голая server-action молчит: оператор жал
// «Сохранить», страница выглядела ровно так же, и понять, применилось ли, было нельзя. Здесь —
// pending на кнопке и строка результата рядом с ней.
//
// Поля формы приходят детьми (их рисует сервер), состоянием заведует только эта обёртка.

export type SaveState = { ok: true } | { ok: false; error: string } | null;

export function SaveForm({
  action,
  children,
  className,
  footerClassName = "sm:col-span-2",
  label = "Сохранить",
}: {
  action: (state: SaveState, form: FormData) => Promise<SaveState>;
  children: React.ReactNode;
  className?: string;
  footerClassName?: string;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(action, null);

  return (
    <form action={formAction} className={className}>
      {children}
      <div className={`flex flex-wrap items-center gap-3 ${footerClassName}`}>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Сохраняю…" : label}
        </Button>
        {/* Ответ показываем только когда запрос уже отработал: иначе на повторном сохранении
            рядом с «Сохраняю…» висел бы прошлый результат */}
        {!pending && state?.ok === true && <span className="text-xs text-emerald-700">Сохранено</span>}
        {!pending && state?.ok === false && <span className="text-xs text-rose-700">{state.error}</span>}
      </div>
    </form>
  );
}
