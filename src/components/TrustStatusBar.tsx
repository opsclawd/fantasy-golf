import type { FreshnessStatus, PoolStatus } from '@/lib/supabase/types'
import { createElement } from 'react'

import { panelClasses, sectionHeadingClasses } from './uiStyles'

interface GetTrustStatusBarStateInput {
  isLocked: boolean
  poolStatus: PoolStatus
  freshness: FreshnessStatus
  refreshedAt: string | null
  lastRefreshError: string | null
  isRefreshing?: boolean
}

type TrustTone = 'info' | 'warning' | 'error'

interface TrustStatusBarState {
  heading: string
  lockLabel: 'Open' | 'Locked'
  lockMessage: string
  freshnessLabel: 'Current' | 'Stale' | 'No data' | 'Refresh failed' | 'Refreshing'
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
  isRefreshing?: boolean,
): Pick<TrustStatusBarState, 'freshnessMessage' | 'tone' | 'role' | 'ariaLive'> {
  if (isRefreshing) {
    const suffix = refreshedAt ? ` Last updated at ${refreshedAt}.` : ''
    return {
      freshnessMessage: `Refreshing scores...${suffix}`,
      tone: 'info',
      role: 'status',
      ariaLive: 'polite',
    }
  }

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
      return 'border-red-200/80 bg-red-50/95 text-red-950'
    case 'warning':
      return 'border-amber-200/80 bg-amber-50/95 text-amber-950'
    default:
      return 'border-emerald-200/80 bg-white/95 text-slate-900'
  }
}

function getFreshnessLabel(
  freshness: FreshnessStatus,
  lastRefreshError: string | null,
  isRefreshing?: boolean,
): TrustStatusBarState['freshnessLabel'] {
  if (isRefreshing) {
    return 'Refreshing'
  }

  if (lastRefreshError) {
    return 'Refresh failed'
  }

  if (freshness === 'current') {
    return 'Current'
  }

  if (freshness === 'stale') {
    return 'Stale'
  }

  return 'No data'
}

export function getTrustStatusBarState(
  input: GetTrustStatusBarStateInput,
): TrustStatusBarState {
  const heading = 'Tournament status'
  const lockLabel = input.isLocked ? 'Locked' : 'Open'
  const lockMessage = getLockMessage(input.isLocked, input.poolStatus)
  const showFreshness = input.poolStatus !== 'open'
  const freshnessState = getFreshnessMessage(
    input.freshness,
    input.refreshedAt,
    input.lastRefreshError,
    input.isRefreshing,
  )

  return {
    heading,
    lockLabel,
    lockMessage,
    freshnessLabel: getFreshnessLabel(input.freshness, input.lastRefreshError, input.isRefreshing),
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
  const classes = [panelClasses(), 'border p-4', toneClasses(state.tone), className]
    .filter(Boolean)
    .join(' ')

  return createElement(
    'section',
    {
      className: classes,
      role: state.role,
      'aria-live': state.ariaLive,
    },
    createElement(
      'div',
      { className: 'flex items-start justify-between gap-3' },
      createElement(
        'div',
        { className: 'space-y-1' },
        createElement('p', { className: sectionHeadingClasses() }, state.heading),
        createElement(
          'p',
          { className: 'flex items-center gap-2 text-base font-semibold text-slate-950' },
          createElement('span', { 'aria-hidden': 'true' }, state.icon),
          createElement('span', null, `${state.lockLabel} for this pool`),
        ),
      ),
      createElement(
        'span',
        {
          className:
            'inline-flex items-center rounded-full border border-current/10 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]',
        },
        state.lockLabel,
      ),
    ),
    createElement('p', { className: 'mt-3 text-sm text-slate-800' }, state.lockMessage),
    state.showFreshness
      ? createElement(
          'div',
          { className: 'mt-3 rounded-2xl border border-black/5 bg-white/65 px-3 py-2' },
          createElement(
            'p',
            { className: 'text-xs font-semibold uppercase tracking-[0.18em] text-slate-500' },
            `Freshness: ${state.freshnessLabel}`,
          ),
          createElement('p', { className: 'mt-1 text-sm text-slate-800' }, state.freshnessMessage),
        )
      : null,
  )
}
