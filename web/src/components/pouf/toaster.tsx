"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

/* Тосты — один хост на весь сайт (в корневом layout), замена window.alert(),
 * который глохнет во встроенном браузере телеграма.
 *
 * Тема зашита светлой: в проекте одна палитра (Light Clay), провайдера тем нет.
 * Цвета ведут на токены Кита, поэтому тост не нужно перекрашивать отдельно —
 * поверхность подушки, ink Кита, линия Кита и радиус кнопки. */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group font-pouf"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--surface)",
          "--normal-text": "var(--ink)",
          "--normal-border": "var(--line-strong)",
          "--border-radius": "var(--r-control)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
