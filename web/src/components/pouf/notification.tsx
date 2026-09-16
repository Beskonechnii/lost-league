import Link from 'next/link'
import { cx } from 'class-variance-authority'
import { Blob } from './media'
import type { IconName } from './Icon'
import type { Tone } from './tone'

/* Строка панели уведомлений. В Ките, а не по месту: у строки два вида — «лига написала мне»
 * (читается и гаснет) и «лиге нужна работа» (нажимается и ведёт на экран разбора), и собранные
 * классами в одном компоненте страницы они разъезжаются на первой же правке.
 *
 * Отличие ровно одно — значок и тон блоба. Заливка непрочитанного живёт отдельно и с видом события
 * не смешивается: один признак говорит «новое», другой — «про что». Двух смыслов на одном признаке
 * не бывает.
 *
 * Нажимаемость видна: строка с адресом — это `Link` с наведением `RowCard` (`surface.tsx`), без
 * адреса — `div`, который на наведение не отвечает. Одинаковый вид у нажимаемого и ненажимаемого
 * обещает не то, что открывает. */
interface NotificationRowProps {
  icon: IconName
  tone?: Tone
  text: string
  /** Уже подписью: время считает сервер, иначе клиент разойдётся с ним на гидрации. */
  time: string
  unread?: boolean
  /** Экран, где событие разбирают. Без него строка не нажимается. */
  href?: string
  onClick?: () => void
}

export function NotificationRow({ icon, tone = 'mint', text, time, unread, href, onClick }: NotificationRowProps) {
  const className = cx(
    'pouf-notification flex gap-3 rounded-blob px-3.5 py-3 [font:inherit] text-left',
    unread && 'bg-surface-2 cushion-field',
    href &&
      'cursor-pointer [transition:box-shadow_140ms_ease,transform_140ms_ease] hover:cushion-row-hover hover:[transform:translateY(-1px)] active:[transform:translateY(1px)] active:cushion-control-active',
  )

  const body = (
    <>
      <Blob icon={icon} tone={tone} size="xs" />
      {/* Заголовка у служебной строки нет — она одноуровневая: текст в три строки, дальше клип. */}
      <p className="min-w-0 flex-1 line-clamp-3 text-[12.5px] font-bold leading-[1.45] text-ink">{text}</p>
      <span className="shrink-0 whitespace-nowrap text-[11px] font-extrabold text-ink-subtle">{time}</span>
    </>
  )

  if (!href) return <div className={className}>{body}</div>
  return (
    <Link href={href} className={className} onClick={onClick}>
      {body}
    </Link>
  )
}
