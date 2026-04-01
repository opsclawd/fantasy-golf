'use client'

import { useEffect, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'

import { GolferPicker, type Golfer } from '@/components/golfer-picker'
import { SelectionSummaryCard } from '@/components/SelectionSummaryCard'
import { SubmissionConfirmation } from '@/components/SubmissionConfirmation'
import { createClient } from '@/lib/supabase/client'

import { submitPicks, type SubmitPicksState } from './actions'

type PicksFormProps = {
  poolId: string
  poolName: string
  picksPerEntry: number
  existingGolferIds: string[]
  existingGolferNames: Record<string, string>
  rosterGolfers: Golfer[]
  isLocked: boolean
}

function SubmitButton({ hasEnoughPicks, isEdit }: { hasEnoughPicks: boolean; isEdit: boolean }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending || !hasEnoughPicks}
      className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? 'Saving...' : isEdit ? 'Update Picks' : 'Submit Picks'}
    </button>
  )
}

export function PicksForm({
  poolId,
  poolName,
  picksPerEntry,
  existingGolferIds,
  existingGolferNames,
  rosterGolfers,
  isLocked,
}: PicksFormProps) {
  const [state, formAction] = useFormState<SubmitPicksState, FormData>(submitPicks, null)
  const [selectedIds, setSelectedIds] = useState<string[]>(existingGolferIds)
  const [golferNames, setGolferNames] = useState<Record<string, string>>(existingGolferNames)

  useEffect(() => {
    let cancelled = false

    const missingIds = selectedIds.filter((id) => !golferNames[id])

    if (missingIds.length === 0) {
      return undefined
    }

    const loadGolferNames = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('golfers').select('id, name').in('id', missingIds)

      if (cancelled || !data?.length) {
        return
      }

      setGolferNames((current) => {
        const next = { ...current }
        let changed = false

        for (const golfer of data) {
          if (golfer.id && golfer.name && next[golfer.id] !== golfer.name) {
            next[golfer.id] = golfer.name
            changed = true
          }
        }

        return changed ? next : current
      })
    }

    void loadGolferNames()

    return () => {
      cancelled = true
    }
  }, [golferNames, selectedIds, rosterGolfers])

  const selectedGolferNames = selectedIds.map((id) => golferNames[id] ?? 'Loading pick...')

  const hasEnoughPicks = selectedIds.length === picksPerEntry
  if (state?.success) {
    return (
      <div className="space-y-4">
        <SubmissionConfirmation
          golferNames={golferNames}
          golferIds={selectedIds}
          isLocked={isLocked}
          poolName={poolName}
        />
        <SelectionSummaryCard
          selectedCount={selectedIds.length}
          requiredCount={picksPerEntry}
          selectedGolferNames={selectedGolferNames}
        />
        <button
          type="button"
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
          onClick={() => window.location.reload()}
        >
          Edit picks
        </button>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <SelectionSummaryCard
        className="sticky top-3 z-10"
        selectedCount={selectedIds.length}
        requiredCount={picksPerEntry}
        selectedGolferNames={selectedGolferNames}
      />

      <div className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-[0_18px_60px_-24px_rgba(15,23,42,0.35)] backdrop-blur sm:p-6">
        <h2 className="mb-2 text-lg font-semibold text-slate-950">
          {existingGolferIds.length > 0 ? 'Edit Your Picks' : 'Select Your Golfers'}
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          Build your card by searching or filtering the field. Your summary updates as you go.
        </p>
        <GolferPicker
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          maxSelections={picksPerEntry}
          golfers={rosterGolfers}
        />

        <div className="mt-6">
          <SubmitButton hasEnoughPicks={hasEnoughPicks} isEdit={existingGolferIds.length > 0} />
        </div>
      </div>
      <input type="hidden" name="poolId" value={poolId} />
      <input type="hidden" name="golferIds" value={JSON.stringify(selectedIds)} />

      {state?.error ? (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded text-sm" role="alert">
          {state.error}
        </div>
      ) : null}
    </form>
  )
}
