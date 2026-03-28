'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { startPool, closePool, type PoolActionState } from './actions'

function StartSubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:outline-none disabled:opacity-50"
    >
      {pending ? 'Starting...' : 'Start Pool (Go Live)'}
    </button>
  )
}

function CloseSubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:outline-none disabled:opacity-50"
    >
      {pending ? 'Ending...' : 'End Pool'}
    </button>
  )
}

function StartPoolButton({ poolId }: { poolId: string }) {
  const [state, formAction] = useFormState<PoolActionState, FormData>(startPool, null)

  return (
    <div>
      {state?.error && (
        <p className="text-sm text-red-600 mb-1" role="alert">{state.error}</p>
      )}
      <form action={formAction}>
        <input type="hidden" name="poolId" value={poolId} />
        <StartSubmitButton />
      </form>
    </div>
  )
}

function ClosePoolButton({ poolId }: { poolId: string }) {
  const [state, formAction] = useFormState<PoolActionState, FormData>(closePool, null)

  return (
    <div>
      {state?.error && (
        <p className="text-sm text-red-600 mb-1" role="alert">{state.error}</p>
      )}
      <form action={formAction}>
        <input type="hidden" name="poolId" value={poolId} />
        <CloseSubmitButton />
      </form>
    </div>
  )
}

export { StartPoolButton, ClosePoolButton }
