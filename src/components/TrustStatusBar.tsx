import type { FreshnessStatus, PoolStatus } from '@/lib/supabase/types'
import { createElement } from 'react'

interface GetTrustStatusBarStateInput {
  isLocked: boolean
  poolStatus: PoolStatus
  freshness: FreshnessStatus
  refreshedAt: string | null
  lastRefreshError: string | null
}

type TrustTone = 'info' | 'warning' | 'error'

interface TrustStatusBarState {
  heading: string
  lockMessage: string
  freshnessMessage: string
  showFreshness: boolean
  tone: TrustTone
  role: 'status' | 'alert'
  ariaLive: 'polite' | 'assertive'
  icon: string
}

interface TrustStatusBarProps extends GetTrustStatusBarStateInput {
  className?: string
}

function getLockMessage(isLocked: boolean, poolStatus: PoolStatus): string {
  if (!isLocked) {
    return 'You can edit picks until the deadline.'
  }

  switch (poolStatus) {
    case 'live':
      return 'The tournament is live. No changes allowed.'
    case 'complete':
      return 'This tournament is complete.'
    default:
      return 'The picks deadline has passed.'
  }
}

function getFreshnessMessage(
  freshness: FreshnessStatus,
  refreshedAt: string | null,
  lastRefreshError: string | null,
): Pick<TrustStatusBarState, 'freshnessMessage' | 'tone' | 'role' | 'ariaLive'> {
  if (lastRefreshError) {
    return {
      freshnessMessage: `Last refresh error: ${lastRefreshError}.`,
      tone: 'error',
      role: 'alert',
      ariaLive: 'assertive',
    }
  }

  if (freshness === 'current') {
    const suffix = refreshedAt ? ` Last updated at ${refreshedAt}.` : ''

    return {
      freshnessMessage: `Scores are current.${suffix}`,
      tone: 'info',
      role: 'status',
      ariaLive: 'polite',
    }
  }

  if (freshness === 'stale') {
    return {
      freshnessMessage: 'Scores may be delayed. Data is stale.',
      tone: 'warning',
      role: 'status',
      ariaLive: 'polite',
    }
  }

  return {
    freshnessMessage: 'No scoring data is available yet.',
    tone: 'warning',
    role: 'status',
    ariaLive: 'polite',
  }
}

function toneClasses(tone: TrustTone): string {
  switch (tone) {
    case 'error':
      return 'border-red-300 bg-red-50 text-red-900'
    case 'warning':
      return 'border-amber-300 bg-amber-50 text-amber-900'
    default:
      return 'border-slate-300 bg-slate-50 text-slate-900'
  }
}

export function getTrustStatusBarState(
  input: GetTrustStatusBarStateInput,
): TrustStatusBarState {
  const heading = input.isLocked ? 'Picks are locked' : 'Picks are open'
  const lockMessage = getLockMessage(input.isLocked, input.poolStatus)
  const showFreshness = input.poolStatus !== 'open'
  const freshnessState = getFreshnessMessage(
    input.freshness,
    input.refreshedAt,
    input.lastRefreshError,
  )

  return {
    heading,
    lockMessage,
    freshnessMessage: freshnessState.freshnessMessage,
    showFreshness,
    tone: freshnessState.tone,
    role: freshnessState.role,
    ariaLive: freshnessState.ariaLive,
    icon: input.isLocked ? '\uD83D\uDD12' : '\uD83D\uDD13',
  }
}

export function TrustStatusBar({ className, ...input }: TrustStatusBarProps) {
  const state = getTrustStatusBarState(input)
  const classes = `rounded-lg border p-3 ${toneClasses(state.tone)} ${className ?? ''}`.trim()

  return createElement(
    'section',
    {
      className: classes,
      role: state.role,
      'aria-live': state.ariaLive,
    },
    createElement(
      'p',
      { className: 'flex items-center gap-2 text-sm font-semibold' },
      createElement('span', { 'aria-hidden': 'true' }, state.icon),
      createElement('span', null, state.heading),
    ),
    createElement('p', { className: 'mt-1 text-sm' }, state.lockMessage),
    state.showFreshness
      ? createElement('p', { className: 'mt-1 text-sm' }, state.freshnessMessage)
      : null,
  )
}
