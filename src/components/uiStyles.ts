export function pageShellClasses() {
  return [
    'min-h-screen',
    'bg-[radial-gradient(circle_at_top,_rgba(234,179,8,0.16),_transparent_28%),linear-gradient(180deg,#f6f1e7_0%,#eef3ea_48%,#e7efe8_100%)]',
    'text-slate-900',
  ].join(' ')
}

export function panelClasses() {
  return [
    'rounded-3xl',
    'border',
    'border-white/60',
    'bg-white/90',
    'shadow-[0_18px_60px_-24px_rgba(15,23,42,0.35)]',
    'backdrop-blur',
  ].join(' ')
}

export function metricCardClasses() {
  return [panelClasses(), 'min-h-[8rem]', 'p-5'].join(' ')
}

export function scrollRegionFocusClasses() {
  return [
    'focus-visible:outline-none',
    'focus-visible:ring-inset',
    'focus-visible:ring-2',
    'focus-visible:ring-green-500',
  ].join(' ')
}

export function sectionHeadingClasses() {
  return [
    'text-[0.7rem]',
    'font-semibold',
    'uppercase',
    'tracking-[0.18em]',
    'text-green-800/70',
  ].join(' ')
}
