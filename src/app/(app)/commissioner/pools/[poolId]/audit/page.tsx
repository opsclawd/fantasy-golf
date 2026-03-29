import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuditEventsForPool, getPoolById } from '@/lib/pool-queries'
import type { AuditEvent } from '@/lib/supabase/types'

type ActionMeta = {
  label: string
  icon: string
  iconClassName: string
}

const ACTION_META: Record<string, ActionMeta> = {
  poolCreated: {
    label: 'Pool Created',
    icon: '+',
    iconClassName: 'bg-emerald-100 text-emerald-700',
  },
  playerJoined: {
    label: 'Player Joined',
    icon: '->',
    iconClassName: 'bg-blue-100 text-blue-700',
  },
  picksSubmitted: {
    label: 'Picks Submitted',
    icon: 'S',
    iconClassName: 'bg-sky-100 text-sky-700',
  },
  picksUpdated: {
    label: 'Picks Updated',
    icon: 'U',
    iconClassName: 'bg-indigo-100 text-indigo-700',
  },
  poolStarted: {
    label: 'Pool Started',
    icon: '>',
    iconClassName: 'bg-emerald-100 text-emerald-700',
  },
  poolClosed: {
    label: 'Pool Closed',
    icon: '||',
    iconClassName: 'bg-slate-200 text-slate-700',
  },
  poolCloned: {
    label: 'Pool Reused',
    icon: 'C',
    iconClassName: 'bg-fuchsia-100 text-fuchsia-700',
  },
  poolConfigUpdated: {
    label: 'Pool Settings Updated',
    icon: '*',
    iconClassName: 'bg-violet-100 text-violet-700',
  },
  entryLocked: {
    label: 'Entries Locked',
    icon: 'L',
    iconClassName: 'bg-amber-100 text-amber-700',
  },
  scoreRefreshCompleted: {
    label: 'Scores Refreshed',
    icon: 'R',
    iconClassName: 'bg-teal-100 text-teal-700',
  },
  scoreRefreshFailed: {
    label: 'Score Refresh Failed',
    icon: '!',
    iconClassName: 'bg-rose-100 text-rose-700',
  },
}

function getActionMeta(action: string): ActionMeta {
  return (
    ACTION_META[action] ?? {
      label: action,
      icon: '?',
      iconClassName: 'bg-gray-100 text-gray-700',
    }
  )
}

function formatActionDetailValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value === null) return 'null'
  if (Array.isArray(value) || typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }

  return String(value)
}

function renderEventDetails(event: AuditEvent) {
  const detailEntries = Object.entries(event.details ?? {})

  if (detailEntries.length === 0) {
    return <p className="mt-2 text-sm text-gray-500">No additional details for this event.</p>
  }

  return (
    <div className="mt-2 overflow-x-auto rounded-md border border-gray-200 bg-gray-50">
      <table className="w-full text-sm">
        <tbody>
          {detailEntries.map(([key, value]) => (
            <tr key={key} className="border-t first:border-t-0">
              <th className="w-48 px-3 py-2 text-left font-medium text-gray-600 align-top">{key}</th>
              <td className="px-3 py-2 text-gray-800 whitespace-pre-wrap break-words">
                {formatActionDetailValue(value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default async function CommissionerPoolAuditPage({
  params,
}: {
  params: Promise<{ poolId: string }>
}) {
  const { poolId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const pool = await getPoolById(supabase, poolId)
  if (!pool) redirect('/commissioner')
  if (pool.commissioner_id !== user.id) redirect('/commissioner')

  const events = await getAuditEventsForPool(supabase, poolId, { limit: 100 })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-gray-500">
            Event history for <span className="font-medium text-gray-700">{pool.name}</span>
          </p>
          <p className="mt-2 text-sm">
            <Link
              href={`/commissioner/pools/${poolId}/audit/score-trace`}
              className="font-medium text-blue-600 hover:text-blue-800"
            >
              View score trace
            </Link>
          </p>
        </div>
        <Link
          href={`/commissioner/pools/${poolId}`}
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          Back to Pool
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="font-medium text-gray-700">No audit events yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Events will appear here as members join, picks change, and scoring updates run.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(event => {
            const actionMeta = getActionMeta(event.action)
            const createdAt = new Date(event.created_at)
            const createdAtLabel = Number.isNaN(createdAt.getTime())
              ? event.created_at
              : createdAt.toLocaleString()
            const actorLabel = event.user_id ? event.user_id.slice(0, 8) : 'System'

            return (
              <article key={event.id} className="rounded-lg bg-white p-4 shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span
                      className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-xs font-semibold ${actionMeta.iconClassName}`}
                      aria-hidden="true"
                    >
                      {actionMeta.icon}
                    </span>
                    <div>
                      <p className="font-semibold text-gray-900">{actionMeta.label}</p>
                      <p className="text-xs text-gray-500">{event.action}</p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p>{createdAtLabel}</p>
                    <p>By: {actorLabel}</p>
                  </div>
                </div>

                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium text-blue-700 hover:text-blue-800">
                    View details
                  </summary>
                  {renderEventDetails(event)}
                </details>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
