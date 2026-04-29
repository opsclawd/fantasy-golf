'use client'

import { useState } from 'react'
import { useFormState } from 'react-dom'
import { deletePool, type PoolActionState } from './actions'
import { ConfirmModal } from '@/components/ConfirmModal'

export function DeletePoolButton({ poolId, poolName }: { poolId: string; poolName: string }) {
  const [state, formAction] = useFormState<PoolActionState, FormData>(deletePool, null)
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <div>
      {state?.error && (
        <p className="text-sm text-red-600 mb-1" role="alert">{state.error}</p>
      )}
      {showConfirm ? (
        <ConfirmModal
          title={`Delete pool '${poolName}'?`}
          body="This action cannot be undone. All entries and picks will be permanently deleted."
          confirmLabel="Delete"
          isDestructive={true}
          requireTextMatch={{ text: poolName, label: poolName }}
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
          className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:outline-none"
        >
          Delete Pool
        </button>
      )}
    </div>
  )
}