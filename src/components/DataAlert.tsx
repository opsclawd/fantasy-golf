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
  }
> = {
  error: {
    icon: '!',
    srPrefix: 'Error:',
    classes: 'border-red-200 bg-red-50/95 text-red-950',
  },
  warning: {
    icon: '!',
    srPrefix: 'Warning:',
    classes: 'border-amber-200 bg-amber-50/95 text-amber-950',
  },
  info: {
    icon: 'i',
    srPrefix: 'Info:',
    classes: 'border-sky-200 bg-sky-50/95 text-sky-950',
  },
}

export function DataAlert({ variant, title, message, className }: DataAlertProps) {
  const config = VARIANT_CONFIG[variant]
  const liveRegionProps = getDataAlertLiveRegion(variant)
  const classes = [
    panelClasses(),
    'inline-flex items-start gap-3 border px-4 py-3 text-sm',
    config.classes,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} {...liveRegionProps}>
      <span
        aria-hidden="true"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current/10 bg-white/70 font-semibold leading-5"
      >
        {config.icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span>
          <span className="sr-only">{config.srPrefix} </span>
          <span className={`${sectionHeadingClasses().replace('text-emerald-800/70', 'text-current')} break-words`}>
            {title}
          </span>
        </span>
        {message ? <span className="break-words text-sm normal-case tracking-normal">{message}</span> : null}
      </span>
    </div>
  )
}
