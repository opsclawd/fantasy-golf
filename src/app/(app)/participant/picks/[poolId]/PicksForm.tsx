'use client'

import { GolferPicker } from '@/components/golfer-picker'
import { SubmissionConfirmation } from '@/components/SubmissionConfirmation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { submitPicks, type SubmitPicksState } from './actions'

type PicksFormProps = {
  poolId: string
  poolName: string
  picksPerEntry: number
  existingGolferIds: string[]
  existingGolferNames: Record<string, string>
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
  isLocked,
}: PicksFormProps) {
  const [state, formAction] = useFormState<SubmitPicksState, FormData>(submitPicks, null)
  const [selectedIds, setSelectedIds] = useState<string[]>(existingGolferIds)
  const [golferNames, setGolferNames] = useState<Record<string, string>>(existingGolferNames)

  useEffect(() => {
    if (selectedIds.length === 0) return

    let active = true
    const supabase = createClient()

    supabase
      .from('golfers')
      .select('id, name')
      .in('id', selectedIds)
      .then(({ data }: { data: Array<{ id: string; name: string }> | null }) => {
        if (!active || !data) return
        setGolferNames((prev) => ({
          ...prev,
          ...Object.fromEntries(data.map((golfer: { id: string; name: string }) => [golfer.id, golfer.name])),
        }))
      })

    return () => {
      active = false
    }
  }, [selectedIds])

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
        <button
          type="button"
          className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          onClick={() => window.location.reload()}
        >
          Edit picks
        </button>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">
          {existingGolferIds.length > 0 ? 'Edit Your Picks' : 'Select Your Golfers'}
        </h2>
        <GolferPicker
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          maxSelections={picksPerEntry}
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
