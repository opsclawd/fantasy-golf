'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { reopenPool, type PoolActionState } from './actions'

function ReopenSubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
    >
      {pending ? 'Reopening...' : 'Reopen Pool'}
    </button>
  )
}

export function ReopenPoolButton({ poolId }: { poolId: string }) {
  const [state, formAction] = useFormState<PoolActionState, FormData>(reopenPool, null)

  return (
    <div>
      {state?.error && (
        <p className="text-sm text-red-600 mb-1" role="alert">{state.error}</p>
      )}
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!confirm('Reopen this pool? Picks will become editable again until the deadline.')) {
            event.preventDefault()
          }
        }}
      >
        <input type="hidden" name="poolId" value={poolId} />
        <ReopenSubmitButton />
      </form>
    </div>
  )
}
