'use client'

import { useFormState } from 'react-dom'

import {
  addMissingGolferAction,
  refreshGolferCatalogAction,
  type GolferCatalogActionState,
} from '@/app/(app)/commissioner/pools/[poolId]/actions'

type Usage = {
  usedCalls: number
  remainingCalls: number
  status: 'ok' | 'warning' | 'blocked'
}

type LatestRun = {
  created_at: string
  status: string
} | null

export function GolferCatalogPanel({
  poolId,
  usage,
  latestRun,
}: {
  poolId: string
  usage: Usage
  latestRun: LatestRun
}) {
  const [refreshState, refreshAction] = useFormState<GolferCatalogActionState, FormData>(refreshGolferCatalogAction, null)
  const [addState, addAction] = useFormState<GolferCatalogActionState, FormData>(addMissingGolferAction, null)
  const warningTone = usage.status === 'warning'
  const blockedTone = usage.status === 'blocked'
  const bulkRefreshDisabled = blockedTone

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_60px_-24px_rgba(15,23,42,0.35)]">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Golfer catalog</p>
      <h2 className="mt-2 text-lg font-semibold text-slate-950">Keep participant search local and current</h2>
      <p className="mt-2 text-sm text-slate-600">{usage.usedCalls} of 250 calls used. {usage.remainingCalls} remaining this month.</p>
      {warningTone ? (
        <p
          data-testid="catalog-usage-status"
          className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900"
        >
          Warning: monthly quota is nearly exhausted.
        </p>
      ) : blockedTone ? (
        <p
          data-testid="catalog-usage-status"
          className="mt-2 inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-900"
        >
          Blocked: bulk syncs are disabled until the monthly quota resets.
        </p>
      ) : null}
      <p className="mt-1 text-sm text-slate-500">
        {latestRun
          ? `Last sync ${latestRun.status} on ${new Date(latestRun.created_at).toLocaleDateString()}.`
          : 'No catalog sync has run yet.'}
      </p>

      <form action={refreshAction} className="mt-4 flex flex-wrap gap-3">
        <input type="hidden" name="poolId" value={poolId} />
        <button
          type="submit"
          name="runType"
          value="monthly_baseline"
          disabled={bulkRefreshDisabled}
          className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
        >
          Refresh monthly catalog
        </button>
        <button
          type="submit"
          name="runType"
          value="pre_tournament"
          disabled={bulkRefreshDisabled}
          className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
        >
          Refresh tournament field
        </button>
      </form>

      {refreshState?.error ? <p className="mt-3 text-sm text-red-600" role="alert" aria-live="polite">{refreshState.error}</p> : null}
      {addState?.error ? (
        <p className="mt-3 text-sm text-red-600" role="alert" aria-live="polite">{addState.error}</p>
      ) : null}

      <form action={addAction} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input type="hidden" name="poolId" value={poolId} />
        <label className="sr-only" htmlFor="golfer-catalog-first-name">First name</label>
        <input
          id="golfer-catalog-first-name"
          name="firstName"
          placeholder="First name"
          className="rounded-xl border border-slate-200 px-3 py-2.5"
        />
        <label className="sr-only" htmlFor="golfer-catalog-last-name">Last name</label>
        <input
          id="golfer-catalog-last-name"
          name="lastName"
          placeholder="Last name"
          className="rounded-xl border border-slate-200 px-3 py-2.5"
        />
        <button
          type="submit"
          className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white"
        >
          Add missing golfer
        </button>
      </form>
    </section>
  )
}
