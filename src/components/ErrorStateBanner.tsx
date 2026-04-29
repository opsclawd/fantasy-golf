import { panelClasses, sectionHeadingClasses } from './uiStyles'

interface ErrorStateBannerProps {
  message: string | null
  onRetry: () => void
}

export function ErrorStateBanner({ message, onRetry }: ErrorStateBannerProps) {
  if (!message) {
    return null
  }

  return (
    <div
      className={`${panelClasses()} mb-4 flex items-center gap-3 border border-red-200 bg-red-50 p-4`}
      role="alert"
      aria-live="assertive"
    >
      <span
        aria-hidden="true"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-red-300 bg-red-100 text-lg"
      >
        ⚠️
      </span>
      <div className="flex-1">
        <p className={sectionHeadingClasses()}>Score refresh failed</p>
        <p className="text-base font-semibold text-red-950">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="shrink-0 rounded-lg border border-red-300 bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
        type="button"
      >
        Retry
      </button>
    </div>
  )
}