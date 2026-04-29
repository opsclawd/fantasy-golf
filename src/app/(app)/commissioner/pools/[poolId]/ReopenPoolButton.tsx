'use client'

import { useState } from 'react'
import { useFormState } from 'react-dom'
import { reopenPool, type PoolActionState } from './actions'
import { ConfirmModal } from '@/components/ConfirmModal'

export function ReopenPoolButton({ poolId }: { poolId: string }) {
  const [state, formAction] = useFormState<PoolActionState, FormData>(reopenPool, null)
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <div>
      {state?.error && (
        <p className="text-sm text-red-600 mb-1" role="alert">{state.error}</p>
      )}
      {showConfirm ? (
        <ConfirmModal
          title="Reopen pool?"
          body="Picks will become editable again until the deadline."
          confirmLabel="Reopen"
          confirmDelaySeconds={3}
          isDestructive={false}
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
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          Reopen Pool
        </button>
      )}
    </div>
  )
}