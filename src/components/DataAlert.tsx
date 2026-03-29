import { getDataAlertLiveRegion } from './data-alert-a11y'

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
    classes: 'bg-red-50 border-red-200 text-red-800',
  },
  warning: {
    icon: '!',
    srPrefix: 'Warning:',
    classes: 'bg-amber-50 border-amber-200 text-amber-800',
  },
  info: {
    icon: 'i',
    srPrefix: 'Info:',
    classes: 'bg-blue-50 border-blue-200 text-blue-800',
  },
}

export function DataAlert({ variant, title, message, className }: DataAlertProps) {
  const config = VARIANT_CONFIG[variant]
  const liveRegionProps = getDataAlertLiveRegion(variant)
  const classes = [
    'inline-flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
    config.classes,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} {...liveRegionProps}>
      <span aria-hidden="true" className="font-semibold leading-5">
        {config.icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span>
          <span className="sr-only">{config.srPrefix} </span>
          <span className="break-words font-semibold">{title}</span>
        </span>
        {message ? <span className="break-words">{message}</span> : null}
      </span>
    </div>
  )
}
