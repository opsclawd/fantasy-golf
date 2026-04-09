'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { deletePool, type PoolActionState } from './actions'

function DeleteSubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:outline-none disabled:opacity-50"
    >
      {pending ? 'Deleting...' : 'Delete Permanently'}
    </button>
  )
}

export function DeletePoolButton({ poolId }: { poolId: string }) {
  const [state, formAction] = useFormState<PoolActionState, FormData>(deletePool, null)

  return (
    <div>
      {state?.error && (
        <p className="text-sm text-red-600 mb-1" role="alert">{state.error}</p>
      )}
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!confirm('Permanently delete this archived pool? This cannot be undone.')) {
            event.preventDefault()
          }
        }}
      >
        <input type="hidden" name="poolId" value={poolId} />
        <DeleteSubmitButton />
      </form>
    </div>
  )
}