'use client'

import { GolferPicker } from '@/components/golfer-picker'
import { SubmissionConfirmation } from '@/components/SubmissionConfirmation'
import { useEffect, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { submitPicks, type SubmitPicksState } from './actions'

const initialState: SubmitPicksState = null

type PicksFormProps = {
  poolId: string
  poolName: string
  picksPerEntry: number
  initialSelectedIds: string[]
  initialGolferNames: Record<string, string>
  initiallySubmitted: boolean
}

function SubmitButton({ hasEnoughPicks }: { hasEnoughPicks: boolean }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending || !hasEnoughPicks}
      className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Submitting...' : 'Submit Picks'}
    </button>
  )
}

export function PicksForm({
  poolId,
  poolName,
  picksPerEntry,
  initialSelectedIds,
  initialGolferNames,
  initiallySubmitted,
}: PicksFormProps) {
  const [state, formAction] = useFormState<SubmitPicksState, FormData>(
    async (_prevState, formData) => submitPicks(formData),
    initialState,
  )
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds)
  const [showConfirmation, setShowConfirmation] = useState(initiallySubmitted)

  const hasEnoughPicks = selectedIds.length === picksPerEntry
  const submitSucceeded = state?.success === true
  const golferNames = initialGolferNames

  useEffect(() => {
    if (submitSucceeded) {
      setShowConfirmation(true)
    }
  }, [submitSucceeded])

  if (showConfirmation && (initiallySubmitted || submitSucceeded)) {
    return (
      <div className="space-y-4">
        <SubmissionConfirmation
          golferNames={golferNames}
          golferIds={selectedIds}
          isLocked={false}
          poolName={poolName}
        />
        <button
          type="button"
          className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          onClick={() => setShowConfirmation(false)}
        >
          Edit picks
        </button>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="poolId" value={poolId} />
      <input type="hidden" name="golferIds" value={JSON.stringify(selectedIds)} />

      {state?.error ? (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded text-sm" role="alert">
          {state.error}
        </div>
      ) : null}

      <GolferPicker
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        maxSelections={picksPerEntry}
      />

      <SubmitButton hasEnoughPicks={hasEnoughPicks} />
    </form>
  )
}
