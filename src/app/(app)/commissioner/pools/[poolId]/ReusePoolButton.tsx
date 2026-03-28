'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { reusePool, type PoolActionState } from './actions'

function ReuseSubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
    >
      {pending ? 'Reusing...' : 'Reuse Pool'}
    </button>
  )
}

export function ReusePoolButton({ poolId }: { poolId: string }) {
  const [state, formAction] = useFormState<PoolActionState, FormData>(reusePool, null)

  return (
    <div>
      {state?.error && (
        <p className="text-sm text-red-600 mb-1" role="alert">{state.error}</p>
      )}
      <form action={formAction}>
        <input type="hidden" name="poolId" value={poolId} />
        <ReuseSubmitButton />
      </form>
    </div>
  )
}
