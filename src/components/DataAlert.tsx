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
  const classes = [
    'rounded-lg border px-3 py-2 text-sm inline-flex items-start gap-2',
    config.classes,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} role="alert" aria-live="polite">
      <span aria-hidden="true" className="font-semibold leading-5">
        {config.icon}
      </span>
      <span className="flex flex-col gap-0.5">
        <span>
          <span className="sr-only">{config.srPrefix} </span>
          <span className="font-semibold">{title}</span>
        </span>
        {message ? <span>{message}</span> : null}
      </span>
    </div>
  )
}
