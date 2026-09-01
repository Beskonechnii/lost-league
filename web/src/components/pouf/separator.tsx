import * as RSeparator from '@radix-ui/react-separator'

export function Separator() {
  return (
    <RSeparator.Root
      className="pouf-separator border-none h-px bg-line-strong my-(--s2) mx-0"
      decorative
    />
  )
}
