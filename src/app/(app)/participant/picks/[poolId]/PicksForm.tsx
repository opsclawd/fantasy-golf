'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'

import { GolferPicker, type Golfer } from '@/components/golfer-picker'
import { Button } from '@/components/ui/Button'
import { SelectionSummaryCard } from '@/components/SelectionSummaryCard'
import { SubmissionConfirmation } from '@/components/SubmissionConfirmation'

import { submitPicks, type SubmitPicksState } from './actions'

type PicksFormProps = {
  poolId: string
  poolName: string
  picksPerEntry: number
  existingGolferIds: string[]
  existingGolferNames: Record<string, string>
  rosterGolferNames: Record<string, string>
  rosterGolfers: Golfer[]
  isLocked: boolean
}

function SubmitButton({ hasEnoughPicks, isEdit }: { hasEnoughPicks: boolean; isEdit: boolean }) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" variant="primary" size="lg" disabled={pending || !hasEnoughPicks}>
      {pending ? 'Saving...' : isEdit ? 'Update Picks' : 'Submit Picks'}
    </Button>
  )
}

export function PicksForm({
  poolId,
  poolName,
  picksPerEntry,
  existingGolferIds,
  existingGolferNames,
  rosterGolferNames,
  rosterGolfers,
  isLocked,
}: PicksFormProps) {
  const [state, formAction] = useFormState<SubmitPicksState, FormData>(submitPicks, null)
  const [selectedIds, setSelectedIds] = useState<string[]>(existingGolferIds)

  const selectedGolferNames = selectedIds.map((id) => rosterGolferNames[id] ?? existingGolferNames[id] ?? 'Unknown golfer')

  const hasEnoughPicks = selectedIds.length === picksPerEntry
  if (state?.success) {
    return (
      <div className="space-y-4">
        <SubmissionConfirmation
          golferNames={rosterGolferNames}
          golferIds={selectedIds}
          isLocked={isLocked}
          poolName={poolName}
        />
        <SelectionSummaryCard
          selectedCount={selectedIds.length}
          requiredCount={picksPerEntry}
          selectedGolferNames={selectedGolferNames}
        />
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={() => window.location.reload()}
        >
          Edit picks
        </Button>
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
        <h2 className="mb-2 text-lg font-semibold text-stone-950">
          {existingGolferIds.length > 0 ? 'Edit Your Picks' : 'Select Your Golfers'}
        </h2>
        <p className="mb-4 text-sm text-stone-600">
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
