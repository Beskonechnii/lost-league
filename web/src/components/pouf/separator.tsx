import * as RSeparator from '@radix-ui/react-separator'

/** Разделитель групп. Вертикальный — для двух групп в ОДНОЙ строке (ряд фильтров, строка хрома):
 *  там нужна не линия под группой, а черта между ними, и второго рисунка на это заводить незачем. */
export function Separator({ orientation = 'horizontal' }: { orientation?: 'horizontal' | 'vertical' }) {
  return (
    <RSeparator.Root
      orientation={orientation}
      className={
        orientation === 'vertical'
          ? 'pouf-separator border-none h-5 w-px shrink-0 self-center bg-line-strong mx-(--s2) my-0'
          : 'pouf-separator border-none h-px bg-line-strong my-(--s2) mx-0'
      }
      decorative
    />
  )
}
