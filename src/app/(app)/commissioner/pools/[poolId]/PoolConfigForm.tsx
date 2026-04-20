'use client'

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { updatePoolConfigAction, type UpdatePoolConfigState } from './actions'
import type { Pool } from '@/lib/supabase/types'
import { panelClasses, scrollRegionFocusClasses, sectionHeadingClasses } from '@/components/uiStyles'

interface TournamentOption {
  id: string
  name: string
  startDate: string
}

interface TimezoneOption {
  value: string
  label: string
}

const CACHE_KEY = 'tournament_schedule_cache'
const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { value: 'America/New_York', label: 'Eastern Time' },
  { value: 'America/Chicago', label: 'Central Time' },
  { value: 'America/Denver', label: 'Mountain Time' },
  { value: 'America/Los_Angeles', label: 'Pacific Time' },
]

function getCachedTournaments(year: string): TournamentOption[] | null {
  if (typeof window === 'undefined') return null

  const cached = localStorage.getItem(`${CACHE_KEY}_${year}`)
  if (!cached) return null

  try {
    const parsed = JSON.parse(cached)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function setCachedTournaments(year: string, tournaments: TournamentOption[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(`${CACHE_KEY}_${year}`, JSON.stringify(tournaments))
}

function getTournamentById(tournaments: TournamentOption[], tournamentId: string): TournamentOption | null {
  return tournaments.find(t => t.id === tournamentId) ?? null
}

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? 'Saving...' : 'Save Configuration'}
    </button>
  )
}

export function PoolConfigForm({ pool, isLocked }: { pool: Pool; isLocked: boolean }) {
  const [state, formAction] = useFormState<UpdatePoolConfigState, FormData>(updatePoolConfigAction, null)
  const [isEditing, setIsEditing] = useState(false)
  const [tournaments, setTournaments] = useState<TournamentOption[]>([])
  const [isLoadingTournaments, setIsLoadingTournaments] = useState(false)
  const [tournamentError, setTournamentError] = useState('')
  const [selectedTournamentId, setSelectedTournamentId] = useState(pool.tournament_id)
  const [selectedTournamentName, setSelectedTournamentName] = useState(pool.tournament_name)
  const [selectedDeadline, setSelectedDeadline] = useState(pool.deadline)
  const [selectedTimezone, setSelectedTimezone] = useState(pool.timezone)
  const [picksPerEntry, setPicksPerEntry] = useState(String(pool.picks_per_entry))

  const isEditable = pool.status === 'open' && !isLocked
  const year = String(pool.year)
  const configLockMessage =
    pool.status === 'archived'
      ? 'Configuration is locked because this pool is archived.'
      : pool.status === 'complete'
        ? 'Configuration is locked because this pool is closed.'
        : 'Configuration is locked because the deadline has passed.'

  const loadTournaments = useCallback(async () => {
    const cached = getCachedTournaments(year)
    if (cached) {
      setTournaments(cached)
      setTournamentError('')
      return
    }

    setIsLoadingTournaments(true)
    try {
      const response = await fetch(`/api/tournaments?year=${year}`)
      if (!response.ok) {
        setTournamentError('Unable to load tournaments right now. Please try again.')
        return
      }

      const data = await response.json()
      if (!Array.isArray(data)) {
        setTournamentError('Received invalid tournament data. Please refresh and try again.')
        return
      }

      const mapped: TournamentOption[] = data
        .map((t: any) => ({
          id: typeof t.tournId === 'string' ? t.tournId : '',
          name: typeof t.name === 'string' ? t.name : '',
          startDate: t.date?.start?.$date?.$numberLong
            ? new Date(Number.parseInt(t.date.start.$date.$numberLong, 10)).toISOString().slice(0, 16)
            : '',
        }))
        .filter((t: TournamentOption) => Boolean(t.id && t.name && t.startDate))

      setTournaments(mapped)
      setCachedTournaments(year, mapped)
      setTournamentError('')
    } catch (error) {
      console.error(error)
      setTournamentError('Unable to load tournaments right now. Please try again.')
    } finally {
      setIsLoadingTournaments(false)
    }
  }, [year])

  useEffect(() => {
    if (isEditing && isEditable) {
      void loadTournaments()
    }
  }, [isEditing, isEditable, loadTournaments])

  const canSubmit = useMemo(() => {
    if (!isEditable || !isEditing) return false
    if (!selectedTournamentId) return false
    return true
  }, [isEditable, isEditing, selectedTournamentId])

  const handleTournamentChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextTournamentId = event.target.value
    setSelectedTournamentId(nextTournamentId)

    const selectedTournament = getTournamentById(tournaments, nextTournamentId)
    setSelectedTournamentName(selectedTournament?.name ?? '')
    setSelectedDeadline(selectedTournament?.startDate ?? '')
  }

  return (
    <section className={`${panelClasses()} p-5`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className={sectionHeadingClasses()}>Pool setup</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">Tournament and format</h2>
          <p className="mt-1 text-sm text-slate-600">
            Keep the essentials in one place while the pool is still open.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsEditing(prev => !prev)}
          disabled={!isEditable}
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isEditing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {!isEditable && (
        <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-100/80 px-4 py-3 text-sm text-slate-700">
          {configLockMessage}
        </p>
      )}

      {state?.error && (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          {state.error}
        </p>
      )}

      {state?.success && (
        <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
          Pool configuration saved.
        </p>
      )}

      {isEditing ? (
        <form action={formAction} className={`mt-5 space-y-4 ${scrollRegionFocusClasses()}`}>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label htmlFor="tournamentId" className="mb-1 block text-sm font-medium text-slate-700">
              Tournament
              </label>
              <select
                id="tournamentId"
                name="tournamentId"
                value={selectedTournamentId}
                onChange={handleTournamentChange}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                disabled={isLoadingTournaments}
                required
              >
                <option value="">
                  {isLoadingTournaments ? 'Loading tournaments...' : 'Select a tournament'}
                </option>
                {tournaments.map(tournament => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.name}
                  </option>
                ))}
              </select>
              {tournamentError && <p className="mt-2 text-sm text-rose-700">{tournamentError}</p>}
            </div>

            <div>
              <label htmlFor="timezone" className="mb-1 block text-sm font-medium text-slate-700">
                Timezone
              </label>
              <select
                id="timezone"
                name="timezone"
                value={selectedTimezone}
                onChange={(event) => setSelectedTimezone(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                required
              >
                {TIMEZONE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="picksPerEntry" className="mb-1 block text-sm font-medium text-slate-700">
                Picks per entry
              </label>
              <select
                id="picksPerEntry"
                name="picksPerEntry"
                value={picksPerEntry}
                onChange={(event) => setPicksPerEntry(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(value => (
                  <option key={value} value={value}>
                    {value} golfer{value === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Changes here update the tournament target and entry size only. Commissioner permissions and pool actions stay the same.
          </div>

          <input type="hidden" name="poolId" value={pool.id} />
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="tournamentName" value={selectedTournamentName} />
          <input type="hidden" name="deadline" value={selectedDeadline} />
          <input type="hidden" name="format" value={pool.format} />

          <SaveButton disabled={!canSubmit} />
        </form>
      ) : (
        <dl className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tournament</dt>
            <dd className="mt-2 text-sm font-medium text-slate-950">{pool.tournament_name}</dd>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Picks per entry</dt>
            <dd className="mt-2 text-sm font-medium text-slate-950">{pool.picks_per_entry}</dd>
          </div>
        </dl>
      )}
    </section>
  )
}
