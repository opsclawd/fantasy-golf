type DataAlertVariant = 'error' | 'warning' | 'info'

type DataAlertLiveRegion =
  | { role: 'alert' }
  | { role: 'status'; 'aria-live': 'polite' }

export function getDataAlertLiveRegion(variant: DataAlertVariant): DataAlertLiveRegion {
  if (variant === 'error') {
    return { role: 'alert' }
  }

  return {
    role: 'status',
    'aria-live': 'polite',
  }
}
