"use client"

/* Поле пароля живёт отдельным файлом, потому что оно единственное в Ките со СВОИМ состоянием
 * (глазик и шкала), а `Input.tsx` тянут и серверные компоненты — админские страницы среди них.
 * Пока хуки лежали в общем файле, `next build` падал на нём тремя ошибками, хотя dev молчал:
 * dev собирает маршрут за маршрутом, прод — весь граф разом. Импорт остался прежним:
 * `Input.tsx` реэкспортирует это поле, звать его по-новому не надо.
 */

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import { FormInput, type FormInputProps } from './Input'
import { IconButton } from './Button'
import { Icon } from './Icon'
import { passwordStrength, type PasswordContext } from '@/lib/password-rules'

interface PasswordFieldProps extends Omit<FormInputProps, 'type'> {
  /** Шкала силы под полем — на заведении и смене пароля. На входе не нужна:
   *  оценивать пароль, который уже когда-то задан, поздно и бессмысленно. */
  strength?: boolean
  /** Почта и ник владельца — чтобы шкала ругалась на то же, на что ругнётся сервер. */
  context?: PasswordContext
}

/**
 * Поле пароля: звёздочки плюс глазик, опционально — шкала силы.
 *
 * Зачем глазик. Пароль набирают вслепую и на телефоне, где промах по клавише — норма; без показа
 * единственный способ поймать опечатку — отправить форму и получить «неверный пароль». Кнопка
 * обязана быть `type="button"`: внутри `<form>` кнопка по умолчанию submit, и «показать пароль»
 * отправляло бы форму.
 *
 * Поле остаётся НЕуправляемым (значение читается из FormData по `name`, как у всего `/me`) —
 * `useState` здесь только для шкалы и потому value в input не возвращается.
 */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { strength, context, className, onChange, defaultValue, ...nativeProps },
  ref,
) {
  const [shown, setShown] = useState(false)
  const [value, setValue] = useState(String(defaultValue ?? ''))
  const input = useRef<HTMLInputElement | null>(null)

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
    onChange?.(e)
  }

  // Сверяемся с полем после каждой отрисовки. Само по себе `onChange` шкалу не удержит:
  // после отправки серверного экшена React возвращает НЕуправляемое поле к defaultValue —
  // поле пустеет, а состояние про это не узнаёт, и под пустым полем висела бы оценка
  // предыдущего пароля. Условие делает эффект однопроходным: значения сравнялись — тишина.
  // Списка зависимостей здесь нет намеренно: сверка обязана идти после КАЖДОЙ отрисовки,
  // а `[value]` её как раз и отключит — сброс поля делает React, состояние при этом
  // не меняется. Цикла нет: условие гасит второй проход.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = input.current
    if (el && el.value !== value) setValue(el.value)
  })

  return (
    <div className={className}>
      <div className="relative">
        <FormInput
          {...nativeProps}
          ref={(el) => {
            input.current = el
            if (typeof ref === 'function') ref(el)
            else if (ref) ref.current = el
          }}
          defaultValue={defaultValue}
          type={shown ? 'text' : 'password'}
          onChange={handleChange}
          className="pr-[52px]"
        />
        {/* Кнопка внутри подушки поля, а не рядом: рядом она уводила бы ширину поля
            и ломала бы одинаковую сетку с соседними полями формы.
            Позиционируем ОБЁРТКОЙ, а не классом на кнопке: у самой кнопки в базе стоит
            `relative`, и второй position-утилитой его не перебить — одноимённые утилиты
            Tailwind не каскадируют (тот же уговор описан в Button.tsx). */}
        <span className="absolute right-[7px] top-1/2 flex -translate-y-1/2">
          <IconButton
            size="sm"
            variant="quiet"
            icon={<Icon name={shown ? 'eye-off' : 'eye'} size="sm" />}
            label={shown ? 'Скрыть пароль' : 'Показать пароль'}
            aria-pressed={shown}
            onClick={() => setShown((v) => !v)}
          />
        </span>
      </div>
      {strength && value.length > 0 && <StrengthMeter value={value} context={context} />}
    </div>
  )
})

/* Шкала — подсказка, а не запрет: отправку она не блокирует, отказ выдаёт сервер
 * (`passwordProblem`). Четыре сегмента, потому что и оценка четырёхступенчатая. */
function StrengthMeter({ value, context }: { value: string; context?: PasswordContext }) {
  const { score, label } = passwordStrength(value, context)
  // Пустая шкала не читается как «плохо», она читается как «сломалось», поэтому у нуля
  // всё равно горит один сегмент — тревожным цветом.
  const lit = Math.max(score, 1)
  const color = score <= 1 ? 'var(--down)' : score === 2 ? 'var(--warn)' : 'var(--up)'

  return (
    <div className="mt-2 flex items-center gap-(--s3)">
      <div className="flex flex-1 gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-[6px] flex-1 rounded-full"
            style={{ background: i < lit ? color : 'var(--line)' }}
          />
        ))}
      </div>
      <span className="text-[13px] font-bold text-muted" aria-live="polite">
        {label}
      </span>
    </div>
  )
}
