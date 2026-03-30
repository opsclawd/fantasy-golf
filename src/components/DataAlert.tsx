import { getDataAlertLiveRegion } from './data-alert-a11y'
import { panelClasses, sectionHeadingClasses } from './uiStyles'

type DataAlertVariant = 'error' | 'warning' | 'info'

interface DataAlertProps {
  variant: DataAlertVariant
  title: string
  message?: string
  className?: string
}

const VARIANT_CONFIG: Record<
  DataAlertVariant,
  {
    icon: string
    srPrefix: string
    classes: string
    iconClasses: string
  }
> = {
  error: {
    icon: '!',
    srPrefix: 'Error:',
    classes: 'border-red-200 bg-red-50/95 text-red-950',
    iconClasses: 'border-red-200/80 bg-white text-red-700',
  },
  warning: {
    icon: '!',
    srPrefix: 'Warning:',
    classes: 'border-amber-200 bg-amber-50/95 text-amber-950',
    iconClasses: 'border-amber-200/80 bg-white text-amber-700',
  },
  info: {
    icon: 'i',
    srPrefix: 'Info:',
    classes: 'border-sky-200 bg-sky-50/95 text-sky-950',
    iconClasses: 'border-sky-200/80 bg-white text-sky-700',
  },
}

export function DataAlert({ variant, title, message, className }: DataAlertProps) {
  const config = VARIANT_CONFIG[variant]
  const liveRegionProps = getDataAlertLiveRegion(variant)
  const classes = [
    panelClasses(),
    'flex items-start gap-3 border px-4 py-4 text-sm',
    config.classes,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} {...liveRegionProps}>
      <span
        aria-hidden="true"
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-semibold leading-5 shadow-sm ${config.iconClasses}`}
      >
        {config.icon}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span>
          <span className="sr-only">{config.srPrefix} </span>
          <span
            className={`${sectionHeadingClasses().replace('text-emerald-800/70', 'text-current').replace('uppercase', 'normal-case').replace('tracking-[0.18em]', 'tracking-[0.08em]')} break-words`}
          >
            {title}
          </span>
        </span>
        {message ? <span className="break-words text-sm leading-6 normal-case tracking-normal opacity-90">{message}</span> : null}
      </span>
    </div>
  )
}
