'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { archivePool, type PoolActionState } from './actions'

function ArchiveSubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:opacity-50"
    >
      {pending ? 'Archiving...' : 'Archive Pool'}
    </button>
  )
}

export function ArchivePoolButton({ poolId }: { poolId: string }) {
  const [state, formAction] = useFormState<PoolActionState, FormData>(archivePool, null)

  return (
    <div>
      {state?.error && (
        <p className="text-sm text-red-600 mb-1" role="alert">{state.error}</p>
      )}
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!confirm('Archive this pool? Archived pools stay read-only and can be deleted later.')) {
            event.preventDefault()
          }
        }}
      >
        <input type="hidden" name="poolId" value={poolId} />
        <ArchiveSubmitButton />
      </form>
    </div>
  )
}
