import { cva } from 'class-variance-authority'
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

interface FieldProps {
  label: string
  children: (id: string, describedBy: string | undefined) => ReactNode
  hint?: string
  error?: string
}

/** Wraps any control with a real <label for>, hint and error text, and wires
 * aria-describedby. Screens pass a render fn so the same wrapper serves Input,
 * Select and Switch without duplicating the a11y plumbing. */
export function Field({ label, children, hint, error }: FieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined
  return (
    <div className="pouf-field flex flex-col gap-(--s2)">
      {/* Labels use ink so their compact uppercase treatment stays emphatic. */}
      <label className="pouf-label text-[13px] font-black tracking-[0.6px] uppercase text-ink" htmlFor={id}>
        {label}
      </label>
      {children(id, describedBy)}
      {hint && !error && (
        <span className="pouf-hint text-[13px] font-bold text-muted" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {/* FIELD-level validation message: a compact one-liner under a control.
        * NOT the page alert cushion (ErrorNote) — this one must stay quiet, so
        * it keeps the flat little pill it always was. self-start: hug the
        * message rather than stretch to fill a flex/grid cell. */}
      {error && (
        <span
          className="pouf-error text-[13px] font-extrabold text-[var(--color-err-ink)] bg-err rounded-xl py-(--s2) px-(--s3) [align-self:start] max-w-full"
          id={`${id}-err`}
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  )
}

/* One cva for every input voice in the system, exported because the Select and
 * Combobox triggers (and Combobox's search input) wear the same field chrome.
 * `bare` is the NumberInput-capsule voice: the capsule carries the chrome, so
 * the input inside goes transparent and shadowless, and even its disabled fade
 * is suppressed (the capsule already fades; double-fading blurs the value).
 * Shadow ownership is per-variant because same-property utilities don't
 * cascade; a focused invalid input shows the focus ring (pseudo specificity),
 * matching the original selector order. */
export const inputClasses = cva(
  'pouf-input font-bold text-ink border-none rounded-control w-full placeholder:text-muted',
  {
    variants: {
      bare: {
        false: 'bg-bg focus:outline-none focus-visible:outline-none disabled:opacity-55 disabled:cursor-not-allowed',
        true: 'bg-transparent flex-1 min-w-0 min-h-0 text-center px-0 pt-[6px] pb-[10px] text-[15px] [box-shadow:none] focus:[box-shadow:none] focus:outline-none focus-visible:outline-none disabled:opacity-100 disabled:cursor-not-allowed',
      },
      /* Компактное поле нужно ПАНЕЛИ ФИЛЬТРОВ (поиск + разрез над списком), где
       * полноразмерная 52px-подушка спорит с рядом пилюль рядом. Высота 42px
       * совпадает с `SelectTrigger size="sm"` — иначе поиск и селект в одной
       * строке читаются как два разных элемента управления. */
      size: {
        md: 'text-[15px]',
        sm: 'text-[14px]',
      },
      invalid: { true: '', false: '' },
      /* mono OWNS font-family — a base font-pouf would fight it (same-property
       * utilities don't cascade; stylesheet order is not the cascade). */
      mono: {
        true: "[font-family:ui-monospace,'SF_Mono',Menlo,monospace] [font-variant-numeric:tabular-nums]",
        false: 'font-pouf',
      },
    },
    compoundVariants: [
      /* Отступы принадлежат паре bare+size: у «голого» поля капсула носит хром сама. */
      { bare: false, size: 'md', className: 'px-5 pt-[14px] pb-[18px] min-h-[52px]' },
      { bare: false, size: 'sm', className: 'px-4 pt-[10px] pb-[13px] min-h-[42px]' },
      { bare: false, invalid: false, className: 'cushion-field focus:[box-shadow:var(--pouf-field-focus)]' },
      {
        bare: false,
        invalid: true,
        className:
          '[box-shadow:var(--pouf-field),inset_0_0_0_3px_var(--down)] focus:[box-shadow:var(--pouf-field-focus)]',
      },
    ],
    defaultVariants: { bare: false, size: 'md', invalid: false, mono: false },
  },
)

interface InputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'children' | 'className' | 'style' | 'value' | 'onChange'
  > {
  value: string
  onChange: (value: string) => void
  onBlur?: InputHTMLAttributes<HTMLInputElement>['onBlur']
  id?: string
  name?: string
  describedBy?: string
  placeholder?: string
  type?: InputHTMLAttributes<HTMLInputElement>['type']
  autoComplete?: string
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode']
  autoCapitalize?: string
  spellCheck?: boolean
  required?: boolean
  mono?: boolean
  invalid?: boolean
  disabled?: boolean
  label?: string
  /** Internal: the NumberInput capsule carries the chrome. */
  bare?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    value,
    onChange,
    describedBy,
    type = 'text',
    mono,
    invalid,
    label,
    bare,
    ...nativeProps
  },
  ref,
) {
  return (
    <input
      ref={ref}
      {...nativeProps}
      className={inputClasses({ bare: !!bare, invalid: !!invalid, mono })}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      type={type}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      aria-label={label}
    />
  )
})

/* ------------------------------------------------------------------ */
/* Textarea                                                            */
/* ------------------------------------------------------------------ */

interface TextareaProps
  extends Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    'children' | 'className' | 'style' | 'value' | 'onChange'
  > {
  value: string
  onChange: (value: string) => void
  onBlur?: TextareaHTMLAttributes<HTMLTextAreaElement>['onBlur']
  id?: string
  name?: string
  describedBy?: string
  placeholder?: string
  autoComplete?: string
  spellCheck?: boolean
  required?: boolean
  rows?: number
  mono?: boolean
  invalid?: boolean
  disabled?: boolean
  label?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    value,
    onChange,
    describedBy,
    rows = 4,
    mono,
    invalid,
    label,
    ...nativeProps
  },
  ref,
) {
  return (
    <textarea
      ref={ref}
      {...nativeProps}
      className={`${inputClasses({ invalid: !!invalid, mono })} pouf-textarea resize-y min-h-[100px]`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      aria-label={label}
    />
  )
})

/* ------------------------------------------------------------------ */
/* Поля формы (неконтролируемые)                                       */
/* ------------------------------------------------------------------ */

/* Одно поле — две эргономики, и это не второй компонент, а второй вход в тот же
 * `inputClasses`. Хром (вдавленная подушка, фокус-кольцо, невалидное состояние)
 * описан ровно один раз выше; здесь меняется только способ достать значение.
 *
 * Почему нельзя одним: Input выше КОНТРОЛИРУЕМЫЙ — требует value и отдаёт
 * строку. Формы служебной части и /me отправляются серверным экшеном и читают
 * значения из FormData по `name`, безо всякого состояния в React. Заставить их
 * держать состояние ради единого компонента — это лишний ре-рендер на букву и
 * два десятка useState там, где хватало `<form action>`.
 *
 * До Э3 эту роль играл `<Input>` из shadcn — вторая система с собственным
 * цветом и радиусом. Теперь её нет, а поле выглядит одинаково в обоих случаях. */

interface FormInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'size'> {
  invalid?: boolean
  mono?: boolean
  /** sm — компактное поле панели фильтров (см. inputClasses). */
  size?: 'sm' | 'md'
  /** Только раскладка (ширина, отступ) — см. тот же уговор у Button. */
  className?: string
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(function FormInput(
  { invalid, mono, size, className, type = 'text', ...nativeProps },
  ref,
) {
  return (
    <input
      ref={ref}
      {...nativeProps}
      type={type}
      className={`${inputClasses({ invalid: !!invalid, mono, size })} ${className ?? ''}`}
      aria-invalid={invalid || undefined}
    />
  )
})

interface FormTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  invalid?: boolean
  mono?: boolean
  className?: string
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(function FormTextarea(
  { invalid, mono, className, rows = 4, ...nativeProps },
  ref,
) {
  return (
    <textarea
      ref={ref}
      {...nativeProps}
      rows={rows}
      className={`${inputClasses({ invalid: !!invalid, mono })} pouf-textarea resize-y min-h-[100px] ${className ?? ''}`}
      aria-invalid={invalid || undefined}
    />
  )
})

interface FormSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'size'> {
  invalid?: boolean
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Выпадающий список для форм, которые отправляются серверным экшеном.
 *
 * Зачем он рядом с китовым `Select` (radix). Радиксовый список — не `<select>`,
 * а кнопка с попапом: в FormData он ничего не кладёт, и рядом с ним всегда
 * приходится держать скрытое поле и состояние. Формам служебной части
 * («поставить команду в дивизион», «выбрать дивизион заявке») состояние не
 * нужно вовсе — они целиком `<form action={serverAction}>` и работают даже без JS.
 *
 * Поэтому здесь настоящий `<select>`, одетый в тот же хром поля: до Э9 он стоял
 * в админке голым и в Light Clay рисовался системной серой полоской — единственным
 * местом на экране, о котором Кит ничего не знает. Собственная стрелка нужна
 * потому, что `appearance:none` снимает системную вместе с системным видом.
 *
 * Правило выбора: значение уходит серверным экшеном — `FormSelect`; значение
 * живёт в состоянии клиента (фильтр, разрез) — китовый `Select`.
 */
export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(function FormSelect(
  { invalid, size, className, children, ...nativeProps },
  ref,
) {
  return (
    <div className={`relative ${className ?? ''}`}>
      <select
        ref={ref}
        {...nativeProps}
        className={`${inputClasses({ invalid: !!invalid, size })} appearance-none cursor-pointer pr-11`}
        aria-invalid={invalid || undefined}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  )
})

/** Подпись к полю — тот же голос, что у подписи внутри Field (компактный
 *  uppercase на ink). Отдельный экспорт нужен формам, которые верстают
 *  сетку сами и не могут отдать разметку render-функции Field. */
export function Label({
  className = '',
  ...nativeProps
}: LabelHTMLAttributes<HTMLLabelElement> & { className?: string }) {
  return (
    <label
      {...nativeProps}
      className={`pouf-label block font-pouf text-[13px] font-black tracking-[0.6px] uppercase text-ink ${className}`}
    />
  )
}
