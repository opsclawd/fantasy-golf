'use client'

import { useState } from 'react'
import { useFormState } from 'react-dom'
import { archivePool, type PoolActionState } from './actions'
import { ConfirmModal } from '@/components/ConfirmModal'

export function ArchivePoolButton({ poolId }: { poolId: string }) {
  const [state, formAction] = useFormState<PoolActionState, FormData>(archivePool, null)
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <div>
      {state?.error && (
        <p className="text-sm text-red-600 mb-1" role="alert">{state.error}</p>
      )}
      {showConfirm ? (
        <ConfirmModal
          title="Archive pool?"
          body="Archived pools stay read-only and can be deleted later."
          confirmLabel="Archive"
          confirmDelaySeconds={3}
          isDestructive={true}
          onConfirm={() => {
            const formData = new FormData()
            formData.append('poolId', poolId)
            formAction(formData)
          }}
          onCancel={() => setShowConfirm(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="px-4 py-2 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 focus:ring-2 focus:ring-amber-500 focus:outline-none"
        >
          Archive Pool
        </button>
      )}
    </div>
  )
}